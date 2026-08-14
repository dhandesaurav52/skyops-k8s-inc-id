import { Router, Response } from 'express';
import { getRepository } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';

export const ticketsRouter = Router();

// GET /api/v1/tickets
ticketsRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { cluster_id, status, limit } = req.query;

  try {
    const repo = await getRepository();
    const tickets = await repo.listTicketsByOrg(req.user!.organizationId, {
      clusterId: cluster_id as string,
      status: status as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    return res.json(tickets);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// GET /api/v1/tickets/:id
ticketsRouter.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const ticket = await repo.getTicketById(req.params.id, req.user!.organizationId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    return res.json(ticket);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// POST /api/v1/tickets (Create manual ticket)
ticketsRouter.post('/', authenticateToken, requireRole('ADMIN', 'SRE', 'DEVELOPER'), async (req: AuthenticatedRequest, res: Response) => {
  const now = new Date().toISOString();
  const repo = await getRepository();

  try {
    const clusters = await repo.listClustersByOrg(req.user!.organizationId);
    const defaultCluster = clusters[0] || { id: 'cls-default', name: 'production-k8s' };

    const ticket = await repo.createTicket({
      incident_id: req.body.incident_id || '',
      organization_id: req.user!.organizationId,
      title: req.body.title || 'New SRE Incident Ticket',
      description: req.body.description || 'Manual remediation ticket',
      severity: req.body.severity || 'HIGH',
      priority: req.body.priority || 'P1',
      assignee: req.body.assignee || req.user!.email,
      status: req.body.status || 'OPEN',
      cluster_id: req.body.cluster_id || defaultCluster.id,
      cluster_name: req.body.cluster_name || defaultCluster.name,
      namespace: req.body.namespace || 'default',
      resource: req.body.resource || 'Deployment/service',
      category: req.body.category || 'Maintenance',
      impact: req.body.impact || 'Service stability and reliability tracking.',
      root_cause: req.body.root_cause || 'User-initiated maintenance and issue tracking.',
      suggested_actions: req.body.suggested_actions || [
        'Inspect workload health and pods',
        'Verify service endpoints and logs',
      ],
      suggested_command: req.body.suggested_command || 'kubectl get pods -n default',
      suggested_yaml_patch: req.body.suggested_yaml_patch || '',
      evidence: req.body.evidence || ['Manual ticket created by operator'],
      tasks: req.body.tasks || [
        { id: 'tsk-1', text: 'Investigate target workload status', completed: false },
        { id: 'tsk-2', text: 'Apply remediation configuration', completed: false },
        { id: 'tsk-3', text: 'Confirm health and close ticket', completed: false },
      ],
      timeline: [
        {
          timestamp: now,
          title: 'Ticket Created',
          detail: `Created by ${req.user!.name}`,
          author: req.user!.name,
          type: 'event',
        },
      ],
      comments: [
        {
          id: `cmt-${Date.now()}`,
          author: req.user!.name,
          message: 'Ticket opened for tracking.',
          createdAt: now,
        },
      ],
      tags: req.body.tags || ['Manual-Ticket', req.body.namespace || 'default'],
    });

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'ticket_created',
      resource: `Ticket/${ticket.id}`,
      details: `User ${req.user!.email} created ticket "${ticket.title}"`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.status(201).json(ticket);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create ticket', details: err.message });
  }
});

// PATCH /api/v1/tickets/:id
ticketsRouter.patch('/:id', authenticateToken, requireRole('ADMIN', 'SRE', 'DEVELOPER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const ticket = await repo.getTicketById(req.params.id, req.user!.organizationId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const now = new Date().toISOString();
    const timeline = ticket.timeline || [];

    if (req.body.status && req.body.status !== ticket.status) {
      timeline.push({
        timestamp: now,
        title: 'Status Updated',
        detail: `Status changed from ${ticket.status} to ${req.body.status}`,
        author: req.user!.name,
        type: 'status_change',
      });
      if (req.body.status === 'RESOLVED') {
        ticket.resolved_at = now;
        ticket.resolved_by = req.user!.email;
      }
    }

    if (req.body.assignee && req.body.assignee !== ticket.assignee) {
      timeline.push({
        timestamp: now,
        title: 'Assignee Changed',
        detail: `Reassigned from ${ticket.assignee} to ${req.body.assignee}`,
        author: req.user!.name,
        type: 'status_change',
      });
    }

    const updates: any = {
      timeline,
      updated_at: now,
    };

    if (req.body.status) updates.status = req.body.status;
    if (req.body.assignee) updates.assignee = req.body.assignee;
    if (req.body.priority) updates.priority = req.body.priority;
    if (req.body.severity) updates.severity = req.body.severity;
    if (req.body.title) updates.title = req.body.title;
    if (req.body.description) updates.description = req.body.description;
    if (req.body.resolution_notes) updates.resolution_notes = req.body.resolution_notes;
    if (Array.isArray(req.body.tasks)) updates.tasks = req.body.tasks;
    if (Array.isArray(req.body.suggested_actions)) updates.suggested_actions = req.body.suggested_actions;

    const updated = await repo.updateTicket(ticket.id, updates);

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'ticket_updated',
      resource: `Ticket/${ticket.id}`,
      details: `User ${req.user!.email} updated ticket ${ticket.id}`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// PATCH /api/v1/tickets/:id/tasks/:taskId
ticketsRouter.patch('/:id/tasks/:taskId', authenticateToken, requireRole('ADMIN', 'SRE', 'DEVELOPER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const ticket = await repo.getTicketById(req.params.id, req.user!.organizationId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const tasks = ticket.tasks || [];
    const task = tasks.find((t) => t.id === req.params.taskId);
    if (task) {
      task.completed = req.body.completed !== undefined ? !!req.body.completed : !task.completed;
      const updated = await repo.updateTicket(ticket.id, { tasks, updated_at: new Date().toISOString() });
      return res.json(updated);
    }

    return res.json(ticket);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to toggle task item' });
  }
});

// POST /api/v1/tickets/:id/comments
ticketsRouter.post('/:id/comments', authenticateToken, requireRole('ADMIN', 'SRE', 'DEVELOPER'), async (req: AuthenticatedRequest, res: Response) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Comment message is required' });
  }

  try {
    const repo = await getRepository();
    const ticket = await repo.getTicketById(req.params.id, req.user!.organizationId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const now = new Date().toISOString();
    const commentItem = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      author: req.user!.name || req.user!.email,
      message: message.trim(),
      createdAt: now,
    };

    const comments = ticket.comments || [];
    comments.push(commentItem);

    const timeline = ticket.timeline || [];
    timeline.push({
      timestamp: now,
      title: 'Comment Added',
      detail: `Comment by ${commentItem.author}: "${commentItem.message.substring(0, 50)}${commentItem.message.length > 50 ? '...' : ''}"`,
      author: commentItem.author,
      type: 'comment',
    });

    const updated = await repo.updateTicket(ticket.id, { comments, timeline, updated_at: now });

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'ticket_comment_added',
      resource: `Ticket/${ticket.id}`,
      details: `Comment added to ${ticket.id} by ${commentItem.author}`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to add comment' });
  }
});
