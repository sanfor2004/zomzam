import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query, queryOne, execute } from '@/lib/db';
import { execute as dbExecute } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = request.cookies.get('ZOMZAM_SESSION')?.value;
  const user = session ? verifyToken(session) : null;

  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || '';

    switch (action) {
      case 'load': {
        const tasks = await query(
          `SELECT * FROM time_tasks WHERE user_id = ? AND status != 'deleted' ORDER BY FIELD(priority,'urgent','medium','maybe','free'), created_at ASC`,
          [user.id]
        );

        const horizons = await query(
          `SELECT * FROM time_horizons WHERE user_id = ? ORDER BY created_at ASC`,
          [user.id]
        );

        const ideas = await query(
          `SELECT * FROM time_ideas WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
          [user.id]
        );

        const userRow = await queryOne(
          `SELECT timezone, notifications_enabled FROM users WHERE id = ? LIMIT 1`,
          [user.id]
        );

        const grouped: Record<string, any[]> = { week: [], month: [], year: [] };
        for (const h of horizons) {
          if (grouped[h.type]) {
            grouped[h.type].push(h);
          }
        }

        return NextResponse.json({
          success: true,
          tasks,
          horizons: grouped,
          ideas,
          settings: {
            timezone: userRow?.timezone || 'UTC',
            notifications_enabled: !!(userRow?.notifications_enabled),
          },
        });
      }

      case 'update_task': {
        const id = parseInt(body.id || 0);
        const title = (body.title || '').trim();
        const priority = ['urgent', 'medium', 'maybe', 'free'].includes(body.priority) ? body.priority : 'medium';
        const duration = Math.max(5, parseInt(body.duration_block || 25));
        const horizonId = body.horizon_id ? parseInt(body.horizon_id) : null;

        if (!title) {
          return NextResponse.json({ success: false, error: 'Empty title' });
        }

        await execute(
          `UPDATE time_tasks SET title = ?, priority = ?, duration_block = ?, horizon_id = ? WHERE id = ? AND user_id = ?`,
          [title, priority, duration, horizonId, id, user.id]
        );

        const updatedTask = await queryOne(`SELECT * FROM time_tasks WHERE id = ?`, [id]);
        return NextResponse.json({ success: true, task: updatedTask });
      }

      case 'add_task': {
        const title = (body.title || '').trim();
        const priority = ['urgent', 'medium', 'maybe', 'free'].includes(body.priority) ? body.priority : 'medium';
        const duration = Math.max(5, parseInt(body.duration_block || 25));
        const horizonId = body.horizon_id ? parseInt(body.horizon_id) : null;

        if (!title) {
          return NextResponse.json({ success: false, error: 'Empty title' });
        }

        const res = await execute(
          `INSERT INTO time_tasks (user_id, horizon_id, title, priority, duration_block) VALUES (?, ?, ?, ?, ?)`,
          [user.id, horizonId, title, priority, duration]
        );

        const newTask = await queryOne(`SELECT * FROM time_tasks WHERE id = ?`, [res.insertId]);
        return NextResponse.json({ success: true, task: newTask });
      }

      case 'complete_task': {
        const id = parseInt(body.id || 0);
        const actual = body.actual_duration !== undefined ? parseInt(body.actual_duration) : null;
        
        const task = await queryOne(`SELECT title FROM time_tasks WHERE id = ? AND user_id = ?`, [id, user.id]);
        
        await execute(
          `UPDATE time_tasks SET status='completed', completed_at=CURRENT_TIMESTAMP, actual_duration=? WHERE id = ? AND user_id = ?`,
          [actual, id, user.id]
        );

        if (task && task.title.includes('Production Delivery & Launch')) {
          const parts = task.title.split(':');
          if (parts.length > 1) {
            const projectName = parts[0].trim();
            await execute(
              `UPDATE crm_projects SET status = 'delivered' WHERE user_id = ? AND name = ? AND status != 'delivered'`,
              [user.id, projectName]
            );
          }
        }

        return NextResponse.json({ success: true });
      }

      case 'restore_task': {
        const id = parseInt(body.id || 0);
        await execute(
          `UPDATE time_tasks SET status='pending', completed_at=NULL WHERE id = ? AND user_id = ?`,
          [id, user.id]
        );
        return NextResponse.json({ success: true });
      }

      case 'delete_task': {
        const id = parseInt(body.id || 0);
        await execute(
          `UPDATE time_tasks SET status='deleted' WHERE id = ? AND user_id = ?`,
          [id, user.id]
        );
        return NextResponse.json({ success: true });
      }

      case 'update_task_status': {
        const id = parseInt(body.id || 0);
        const allowed = ['pending', 'in_progress', 'completed', 'deleted'];
        const status = allowed.includes(body.status) ? body.status : null;
        if (!id || !status) {
          return NextResponse.json({ success: false, error: 'Invalid id or status' }, { status: 400 });
        }
        await execute(
          `UPDATE time_tasks SET status = ? WHERE id = ? AND user_id = ?`,
          [status, id, user.id]
        );

        if (status === 'completed') {
          const task = await queryOne(`SELECT title FROM time_tasks WHERE id = ? AND user_id = ?`, [id, user.id]);
          if (task && task.title.includes('Production Delivery & Launch')) {
            const parts = task.title.split(':');
            if (parts.length > 1) {
              const projectName = parts[0].trim();
              await execute(
                `UPDATE crm_projects SET status = 'delivered' WHERE user_id = ? AND name = ? AND status != 'delivered'`,
                [user.id, projectName]
              );
            }
          }
        }

        return NextResponse.json({ success: true });
      }

      case 'add_horizon': {
        const type = ['week', 'month', 'year'].includes(body.type) ? body.type : 'week';
        const content = (body.content || '').trim();

        if (!content) {
          return NextResponse.json({ success: false });
        }

        const res = await execute(
          `INSERT INTO time_horizons (user_id, type, content) VALUES (?, ?, ?)`,
          [user.id, type, content]
        );

        const newHorizon = await queryOne(`SELECT * FROM time_horizons WHERE id = ?`, [res.insertId]);
        return NextResponse.json({ success: true, horizon: newHorizon });
      }

      case 'delete_horizon': {
        const id = parseInt(body.id || 0);
        await execute(`DELETE FROM time_horizons WHERE id = ? AND user_id = ?`, [id, user.id]);
        return NextResponse.json({ success: true });
      }

      case 'complete_horizon': {
        const id = parseInt(body.id || 0);
        await execute(`UPDATE time_horizons SET status = 'completed' WHERE id = ? AND user_id = ?`, [id, user.id]);
        return NextResponse.json({ success: true });
      }

      case 'move_horizon': {
        const id = parseInt(body.id || 0);
        const type = ['week', 'month', 'year'].includes(body.type) ? body.type : null;

        if (!id || !type) {
          return NextResponse.json({ success: false });
        }

        await execute(`UPDATE time_horizons SET type = ? WHERE id = ? AND user_id = ?`, [
          type,
          id,
          user.id,
        ]);
        return NextResponse.json({ success: true });
      }

      case 'add_idea': {
        const content = (body.content || '').trim();
        const taskId = body.linked_task_id ? parseInt(body.linked_task_id) : null;
        const horizonId = body.linked_horizon_id ? parseInt(body.linked_horizon_id) : null;

        if (!content) {
          return NextResponse.json({ success: false });
        }

        const res = await execute(
          `INSERT INTO time_ideas (user_id, content, linked_task_id, linked_horizon_id) VALUES (?, ?, ?, ?)`,
          [user.id, content, taskId, horizonId]
        );

        const newIdea = await queryOne(`SELECT * FROM time_ideas WHERE id = ?`, [res.insertId]);
        return NextResponse.json({ success: true, idea: newIdea });
      }

      case 'delete_idea': {
        const id = parseInt(body.id || 0);
        await execute(`DELETE FROM time_ideas WHERE id = ? AND user_id = ?`, [id, user.id]);
        return NextResponse.json({ success: true });
      }

      case 'update_idea': {
        const id = parseInt(body.id || 0);
        const content = (body.content || '').trim();
        const taskId = body.linked_task_id ? parseInt(body.linked_task_id) : null;
        const horizonId = body.linked_horizon_id ? parseInt(body.linked_horizon_id) : null;

        if (!content) {
          return NextResponse.json({ success: false });
        }

        await execute(
          `UPDATE time_ideas SET content = ?, linked_task_id = ?, linked_horizon_id = ? WHERE id = ? AND user_id = ?`,
          [content, taskId, horizonId, id, user.id]
        );
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Time API error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
