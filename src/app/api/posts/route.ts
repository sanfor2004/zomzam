import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import * as posts from '@/lib/services/posts';
import { createNotification, pushStreamOrder } from '@/lib/models/user';

// Notify a repost's original author (both the plain-repost and quote paths land
// here). Skips a self-repost. The nested original — with its author id — rides on
// the normalized post the service returns; a tombstoned/absent original is a no-op.
async function notifyRepostAuthor(
  post: { repost_of?: { id: number; user_id: number } | null },
  actorId: number,
  actorUsername: string,
) {
  const origAuthor = post.repost_of?.user_id;
  if (!origAuthor || origAuthor === actorId) return;
  await createNotification(origAuthor, 'reposted', {
    from_user_id: actorId,
    by_user: actorUsername,
    post_id: post.repost_of!.id,
    message: 'reposted your post',
  });
}

// Thin dispatch layer: authenticate, parse the request body (post creation is
// multipart/form-data because it may carry an image File; every other action is
// JSON), delegate to the posts service, shape the response. Business logic lives
// in @/lib/services/posts.
export const POST = withAuth(async (request, user) => {
  const contentType = request.headers.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');
  let imageFile: File | null = null;
  let body: any;
  if (isMultipart) {
    const formData = await request.formData();
    imageFile = formData.get('image') as File | null;
    body = {
      action: formData.get('action') || 'create',
      post_id: formData.get('post_id'),
      content_html: formData.get('content_html'),
      visibility: formData.get('visibility'),
      type: formData.get('type'),
      skill_tag: formData.get('skill_tag'),
      remove_image: formData.get('remove_image'),
      repost_of: formData.get('repost_of'),
    };
  } else {
    body = await request.json().catch(() => ({}));
  }
  const action = body.action || 'create';

  switch (action) {
    case 'create': {
      const post = await posts.createPost(user.id, {
        contentHtml: body.content_html || '',
        visibility: body.visibility,
        imageFile,
        type: body.type,
        skillTag: body.skill_tag,
        repostOf: body.repost_of ? parseInt(body.repost_of) : undefined,
      });
      // Live "new posts" pill: fan a lightweight signal out to everyone who can
      // see this author's feed (friends + followers) so their feed offers a
      // refresh in real time. touchLastSeen=false → this broadcast must not mark
      // recipients as recently-online on presence rails.
      {
        const audience = await posts.getFeedAudience(user.id);
        await Promise.all(
          audience.map((rid) =>
            pushStreamOrder(
              rid,
              'new_post',
              { post_id: post.id, by_user: user.username },
              false
            )
          )
        );
      }
      // Notify skill-matched friends/followers about a new help request (throttled).
      if (post.type === 'ask' && post.skill_tag) {
        const recipients = await posts.findAskNotifyRecipients(user.id, post.skill_tag);
        await Promise.all(
          recipients.map((rid) =>
            createNotification(rid, 'new_help_request', {
              post_id: post.id,
              skill_tag: post.skill_tag,
              by_user: user.username,
            })
          )
        );
      }
      // A quote repost notifies the original's author (skip a self-repost).
      await notifyRepostAuthor(post, user.id, user.username);
      return NextResponse.json({ success: true, post });
    }

    case 'accept_answer': {
      const { result, helperUserId } = await posts.acceptAnswer(
        user.id,
        parseInt(body.post_id || 0),
        parseInt(body.comment_id || 0)
      );
      // Notify the answer's author (never self-notify on a self-accept).
      if (helperUserId !== user.id) {
        await createNotification(helperUserId, 'answer_accepted', {
          post_id: result.postId,
          comment_id: result.commentId,
          by_user: user.username,
        });
      }
      return NextResponse.json({ success: true, ...result });
    }

    case 'resolve_ask':
      return NextResponse.json({ success: true, ...await posts.resolveAsk(user.id, parseInt(body.post_id || 0)) });

    case 'reopen_ask':
      return NextResponse.json({ success: true, ...await posts.reopenAsk(user.id, parseInt(body.post_id || 0)) });

    case 'post_edit':
      // multipart/form-data: carries the optional image File + remove_image flag.
      return NextResponse.json({
        success: true,
        ...await posts.editPost(user.id, parseInt(body.post_id || 0), {
          contentHtml: body.content_html || '',
          visibility: body.visibility || undefined,
          imageFile,
          removeImage: body.remove_image === '1',
        }),
      });

    case 'like':
      return NextResponse.json({ success: true, ...await posts.toggleLike(user.id, parseInt(body.post_id || 0)) });

    case 'bookmark':
      return NextResponse.json({ success: true, ...await posts.toggleBookmark(user.id, parseInt(body.post_id || 0)) });

    case 'repost': {
      // Plain (empty-comment) repost toggle. On a fresh repost, fan the live pill
      // out to the reposter's audience and notify the original author (skip self).
      const { reposted, post } = await posts.toggleRepost(user.id, parseInt(body.post_id || 0));
      if (reposted && post) {
        const audience = await posts.getFeedAudience(user.id);
        await Promise.all(
          audience.map((rid) =>
            pushStreamOrder(rid, 'new_post', { post_id: post.id, by_user: user.username }, false)
          )
        );
        await notifyRepostAuthor(post, user.id, user.username);
      }
      return NextResponse.json({ success: true, reposted, post });
    }

    case 'comment_vote':
      return NextResponse.json({ success: true, ...await posts.toggleCommentVote(user.id, parseInt(body.comment_id || 0)) });

    case 'comment_edit':
      return NextResponse.json({ success: true, ...await posts.editComment(user.id, parseInt(body.comment_id || 0), body.content || '') });

    case 'comment_delete':
      return NextResponse.json({ success: true, ...await posts.deleteComment(user.id, parseInt(body.comment_id || 0)) });

    case 'delete':
      await posts.deletePost(user.id, parseInt(body.post_id || 0));
      return NextResponse.json({ success: true });

    case 'mark_seen': {
      // Chat-style read receipt: batch-mark posts the viewer has scrolled past.
      const ids = Array.isArray(body.post_ids) ? body.post_ids : [];
      return NextResponse.json({ success: true, ...await posts.markPostsSeen(user.id, ids) });
    }

    case 'comment': {
      const comment = await posts.addComment(
        user.id,
        parseInt(body.post_id || 0),
        body.content || '',
        body.parent_id ? parseInt(body.parent_id) : null
      );
      return NextResponse.json({ success: true, comment });
    }

    default:
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  }
});

export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);

  switch (action) {
    case 'feed': {
      // Tiered, keyset-paginated feed: unseen posts first, then seen backfill.
      // `cursor` is the smallest post id already delivered (see getFeed); absent
      // ⇒ first page of the requested tier.
      const tier = searchParams.get('tier') === 'seen' ? 'seen' : 'unseen';
      const cursor = parseInt(searchParams.get('cursor') || '0') || null;
      return NextResponse.json({
        success: true,
        ...await posts.getFeed(user.id, {
          tier,
          cursor,
          limit,
          filter: searchParams.get('filter') || undefined,
        }),
      });
    }

    case 'saved': {
      // The viewer's bookmarked posts, newest-saved-first, keyset on bookmark id.
      const cursor = parseInt(searchParams.get('cursor') || '0') || null;
      return NextResponse.json({
        success: true,
        ...await posts.getSaved(user.id, { cursor, limit }),
      });
    }

    case 'comments':
      return NextResponse.json({ success: true, comments: await posts.getComments(user.id, parseInt(searchParams.get('post_id') || '0')) });

    case 'top_comments':
      return NextResponse.json({ success: true, comments: await posts.getTopComments(user.id, parseInt(searchParams.get('post_id') || '0')) });

    default:
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  }
});

export const dynamic = 'force-dynamic';
