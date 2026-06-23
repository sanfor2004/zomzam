import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import * as posts from '@/lib/services/posts';
import { createNotification } from '@/lib/models/user';

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
      action: 'create',
      content_html: formData.get('content_html'),
      visibility: formData.get('visibility'),
      type: formData.get('type'),
      skill_tag: formData.get('skill_tag'),
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
      });
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

    case 'like':
      return NextResponse.json({ success: true, ...await posts.toggleLike(user.id, parseInt(body.post_id || 0)) });

    case 'comment_vote':
      return NextResponse.json({ success: true, ...await posts.toggleCommentVote(user.id, parseInt(body.comment_id || 0)) });

    case 'comment_edit':
      return NextResponse.json({ success: true, ...await posts.editComment(user.id, parseInt(body.comment_id || 0), body.content || '') });

    case 'comment_delete':
      return NextResponse.json({ success: true, ...await posts.deleteComment(user.id, parseInt(body.comment_id || 0)) });

    case 'delete':
      await posts.deletePost(user.id, parseInt(body.post_id || 0));
      return NextResponse.json({ success: true });

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
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);

  switch (action) {
    case 'feed':
      return NextResponse.json({ success: true, ...await posts.getFeed(user.id, offset, limit, searchParams.get('filter') || undefined) });

    case 'comments':
      return NextResponse.json({ success: true, comments: await posts.getComments(user.id, parseInt(searchParams.get('post_id') || '0')) });

    case 'top_comments':
      return NextResponse.json({ success: true, comments: await posts.getTopComments(user.id, parseInt(searchParams.get('post_id') || '0')) });

    default:
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  }
});

export const dynamic = 'force-dynamic';
