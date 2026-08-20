import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { query, transaction } from '@/lib/db';
import { NotionService } from '@/lib/notion';

export const GET = withAuth(async (request, user) => {
  const rows = await query(
    'SELECT `key`, value FROM user_settings WHERE user_id = ? AND `key` LIKE "NOTION_%"',
    [user.id]
  );
  const settings: Record<string, string> = {};
  rows.forEach((row: any) => {
    settings[row.key] = row.value;
  });

  return NextResponse.json({ success: true, settings });
});

export const POST = withAuth(async (request, user) => {
  const body = await request.json().catch(() => ({}));
  const action = body.action || '';

  switch (action) {
    case 'update_settings': {
      const settings = body.settings || {};

      await transaction(async (connection) => {
        for (const [key, value] of Object.entries(settings)) {
          // Keep keys formatted with NOTION_ prefix
          if (key.startsWith('NOTION_')) {
            await connection.execute(
              `INSERT INTO user_settings (user_id, \`key\`, value)
               VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE value = ?`,
              [user.id, key, value, value] as any
            );
          }
        }
      });
      return NextResponse.json({ success: true });
    }

    case 'sync': {
      // 1. Load settings
      const rows = await query(
        'SELECT `key`, value FROM user_settings WHERE user_id = ? AND `key` LIKE "NOTION_%"',
        [user.id]
      );

      const settings: Record<string, string> = {};
      rows.forEach((row: any) => {
        settings[row.key] = row.value;
      });

      const apiKey = settings.NOTION_API_KEY;
      const tasksDbId = settings.NOTION_DATABASE_ID_TASKS;
      const linksDbId = settings.NOTION_DATABASE_ID_LINKS;

      if (!apiKey) {
        return NextResponse.json({ success: false, error: 'Notion API Key is not configured.' });
      }
      if (!tasksDbId) {
        return NextResponse.json({ success: false, error: 'Notion Tasks Database ID is not configured.' });
      }

      const notion = new NotionService(apiKey);
      let syncedLinks = 0;
      let syncedTasks = 0;

      await transaction(async (connection) => {
        // ==========================================
        // PHASE B: SYNC LINKS
        // ==========================================
        if (linksDbId) {
          // Pull links from Notion
          const notionLinks = await notion.queryDatabase(linksDbId);
          for (const page of notionLinks) {
            const notionPageId = page.id;
            const linkProps = notion.parseLink(page);

            const [localLinkRows] = await connection.execute<any[]>(
              'SELECT id FROM time_links WHERE notion_page_id = ? AND user_id = ? LIMIT 1',
              [notionPageId, user.id]
            );

            if (localLinkRows.length > 0) {
              // Update
              await connection.execute(
                'UPDATE time_links SET title = ?, url = ? WHERE notion_page_id = ? AND user_id = ?',
                [linkProps.title, linkProps.url, notionPageId, user.id]
              );
            } else {
              // Insert
              await connection.execute(
                'INSERT INTO time_links (user_id, title, url, notion_page_id) VALUES (?, ?, ?, ?)',
                [user.id, linkProps.title, linkProps.url, notionPageId]
              );
            }
            syncedLinks++;
          }

          // Push locally created links to Notion
          const [localUnsyncedLinks] = await connection.execute<any[]>(
            'SELECT * FROM time_links WHERE notion_page_id IS NULL AND user_id = ?',
            [user.id]
          );

          for (const link of localUnsyncedLinks) {
            const notionProps = notion.buildLinkProperties({
              title: link.title,
              url: link.url,
            });

            const notionPageId = await notion.createPage(linksDbId, notionProps);
            await connection.execute(
              'UPDATE time_links SET notion_page_id = ? WHERE id = ? AND user_id = ?',
              [notionPageId, link.id, user.id]
            );
            syncedLinks++;
          }
        }

        // ==========================================
        // PHASE C: SYNC TASKS
        // ==========================================
        // Pull tasks from Notion
        const notionTasks = await notion.queryDatabase(tasksDbId);
        for (const page of notionTasks) {
          const notionPageId = page.id;
          const taskProps = notion.parseTask(page);

          // Check if task exists locally
          const [localTaskRows] = await connection.execute<any[]>(
            'SELECT id FROM time_tasks WHERE notion_page_id = ? AND user_id = ? LIMIT 1',
            [notionPageId, user.id]
          );

          let taskId: number;
          if (localTaskRows.length > 0) {
            taskId = localTaskRows[0].id;
            // Update task
            await connection.execute(
              `UPDATE time_tasks
               SET title = ?, priority = ?, duration_block = ?, actual_duration = ?, status = ?
               WHERE id = ? AND user_id = ?`,
              [
                taskProps.title,
                taskProps.priority,
                taskProps.duration_block,
                taskProps.actual_duration,
                taskProps.status,
                taskId,
                user.id,
              ]
            );
          } else {
            // Insert task
            const [res] = await connection.execute<any>(
              `INSERT INTO time_tasks
               (user_id, title, priority, duration_block, actual_duration, status, notion_page_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                user.id,
                taskProps.title,
                taskProps.priority,
                taskProps.duration_block,
                taskProps.actual_duration,
                taskProps.status,
                notionPageId,
              ]
            );
            taskId = res.insertId;
          }

          // Sync links relation
          await connection.execute('DELETE FROM time_task_links WHERE task_id = ?', [taskId]);

          for (const linkNotionId of taskProps.linksNotionPageIds) {
            const [linkRows] = await connection.execute<any[]>(
              'SELECT id FROM time_links WHERE notion_page_id = ? AND user_id = ? LIMIT 1',
              [linkNotionId, user.id]
            );
            if (linkRows.length > 0) {
              const linkId = linkRows[0].id;
              await connection.execute(
                'INSERT INTO time_task_links (task_id, link_id) VALUES (?, ?)',
                [taskId, linkId]
              );
            }
          }

          syncedTasks++;
        }

        // Push locally created tasks to Notion
        const [localUnsyncedTasks] = await connection.execute<any[]>(
          `SELECT * FROM time_tasks
           WHERE notion_page_id IS NULL AND status != 'deleted' AND user_id = ?`,
          [user.id]
        );

        for (const task of localUnsyncedTasks) {
          // Find related Links' Notion Page IDs
          const [linkRows] = await connection.execute<any[]>(
            `SELECT l.notion_page_id
             FROM time_links l
             JOIN time_task_links tl ON l.id = tl.link_id
             WHERE tl.task_id = ? AND l.notion_page_id IS NOT NULL`,
            [task.id]
          );
          const linksNotionPageIds = linkRows.map((row: any) => row.notion_page_id);

          const notionProps = notion.buildTaskProperties({
            title: task.title,
            priority: task.priority,
            duration_block: task.duration_block,
            actual_duration: task.actual_duration,
            status: task.status,
            linksNotionPageIds,
          });

          const notionPageId = await notion.createPage(tasksDbId, notionProps);
          await connection.execute(
            'UPDATE time_tasks SET notion_page_id = ? WHERE id = ? AND user_id = ?',
            [notionPageId, task.id, user.id]
          );
          syncedTasks++;
        }
      });

      return NextResponse.json({
        success: true,
        stats: {
          links: syncedLinks,
          tasks: syncedTasks,
        },
      });
    }

    default:
      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  }
});
