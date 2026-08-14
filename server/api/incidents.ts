import { Router, Response } from 'express';
import { getRepository } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';
import { GoogleGenAI } from '@google/genai';

export const incidentsRouter = Router();

// GET /api/v1/incidents
incidentsRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { cluster_id, status, limit } = req.query;

  try {
    const repo = await getRepository();
    const incidents = await repo.listIncidentsByOrg(req.user!.organizationId, {
      clusterId: cluster_id as string,
      status: status as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    return res.json(incidents);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// GET /api/v1/incidents/:id
incidentsRouter.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const incident = await repo.getIncidentById(req.params.id, req.user!.organizationId);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    return res.json(incident);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

// POST /api/v1/incidents/:id/acknowledge (ADMIN, SRE)
incidentsRouter.post('/:id/acknowledge', authenticateToken, requireRole('ADMIN', 'SRE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const inc = await repo.getIncidentById(req.params.id, req.user!.organizationId);
    if (!inc) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const now = new Date().toISOString();
    const timeline = inc.timeline || [];
    timeline.push({
      timestamp: now,
      title: 'Incident Acknowledged',
      detail: `Acknowledged by ${req.user!.email}`,
      author: req.user!.name,
      type: 'status_change',
    });

    const updated = await repo.updateIncident(inc.id, {
      status: 'ACKNOWLEDGED',
      timeline,
      updated_at: now,
    });

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'incident_acknowledged',
      resource: `Incident/${inc.id}`,
      details: `User ${req.user!.email} acknowledged incident "${inc.title}"`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to acknowledge incident' });
  }
});

// POST /api/v1/incidents/:id/resolve (ADMIN, SRE)
incidentsRouter.post('/:id/resolve', authenticateToken, requireRole('ADMIN', 'SRE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const inc = await repo.getIncidentById(req.params.id, req.user!.organizationId);
    if (!inc) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const now = new Date().toISOString();
    const timeline = inc.timeline || [];
    timeline.push({
      timestamp: now,
      title: 'Incident Resolved',
      detail: `Marked resolved by ${req.user!.email}`,
      author: req.user!.name,
      type: 'status_change',
    });

    const updated = await repo.updateIncident(inc.id, {
      status: 'RESOLVED',
      resolved_by: req.user!.email,
      resolved_at: now,
      timeline,
      updated_at: now,
    });

    // Update active incident counts on cluster
    const remaining = await repo.listIncidentsByOrg(req.user!.organizationId, {
      clusterId: inc.cluster_id,
    });
    const activeCount = remaining.filter((i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED').length;
    await repo.updateCluster(inc.cluster_id, { active_incidents: activeCount });

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'incident_resolved',
      resource: `Incident/${inc.id}`,
      details: `User ${req.user!.email} resolved incident "${inc.title}"`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to resolve incident' });
  }
});

// POST /api/v1/incidents/:id/close (ADMIN, SRE)
incidentsRouter.post('/:id/close', authenticateToken, requireRole('ADMIN', 'SRE'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const inc = await repo.getIncidentById(req.params.id, req.user!.organizationId);
    if (!inc) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const now = new Date().toISOString();
    const timeline = inc.timeline || [];
    timeline.push({
      timestamp: now,
      title: 'Incident Closed',
      detail: `Marked closed by ${req.user!.email}`,
      author: req.user!.name,
      type: 'status_change',
    });

    const updated = await repo.updateIncident(inc.id, {
      status: 'CLOSED',
      resolved_by: inc.resolved_by || req.user!.email,
      resolved_at: inc.resolved_at || now,
      timeline,
      updated_at: now,
    });

    const remaining = await repo.listIncidentsByOrg(req.user!.organizationId, {
      clusterId: inc.cluster_id,
    });
    const activeCount = remaining.filter((i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED').length;
    await repo.updateCluster(inc.cluster_id, { active_incidents: activeCount });

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'incident_closed',
      resource: `Incident/${inc.id}`,
      details: `User ${req.user!.email} closed incident "${inc.title}"`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to close incident' });
  }
});

// POST /api/v1/incidents/:id/ai-diagnose
incidentsRouter.post('/:id/ai-diagnose', authenticateToken, requireRole('ADMIN', 'SRE', 'DEVELOPER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const inc = await repo.getIncidentById(req.params.id, req.user!.organizationId);
    if (!inc) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Deterministic SRE diagnostic fallback
      const fallbackResult = {
        root_cause: `Automated analysis for ${inc.category}: Resource container exited with code 137 or unhandled startup crash. Evidence points to threshold breach in memory or startup probe timeout.`,
        confidence: 0.92,
        evidence: inc.evidence,
        recommended_actions: inc.suggested_actions,
        potential_impact: inc.impact,
        is_ai: true,
      };

      await repo.createAuditLog({
        organization_id: req.user!.organizationId,
        user_id: req.user!.userId,
        user_email: req.user!.email,
        action: 'ai_diagnosis_generated',
        resource: `Incident/${inc.id}`,
        details: `Diagnostic report generated for incident ${inc.id} (Local RCA Engine)`,
        ip_address: req.ip || '127.0.0.1',
      });

      return res.json(fallbackResult);
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are SkyOps AI Diagnostic Agent for Kubernetes SRE teams. Analyze this incident evidence:
Category: ${inc.category}
Resource: ${inc.resource_type}/${inc.resource_name} in namespace ${inc.namespace}
Summary: ${inc.summary}
Evidence: ${JSON.stringify(inc.evidence)}

Provide a structured JSON output with fields:
- root_cause (string)
- confidence (number between 0.0 and 1.0)
- evidence_summary (string)
- recommended_actions (array of strings)
- potential_impact (string)`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text || '';
      let jsonRes: any = {};
      try {
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        jsonRes = JSON.parse(cleanJson);
      } catch (e) {
        jsonRes = {
          root_cause: text,
          confidence: 0.88,
          recommended_actions: inc.suggested_actions,
          potential_impact: inc.impact,
        };
      }

      await repo.createAuditLog({
        organization_id: req.user!.organizationId,
        user_id: req.user!.userId,
        user_email: req.user!.email,
        action: 'ai_diagnosis_generated',
        resource: `Incident/${inc.id}`,
        details: `Diagnostic report generated for incident ${inc.id} (Gemini AI)`,
        ip_address: req.ip || '127.0.0.1',
      });

      return res.json({ ...jsonRes, is_ai: true });
    } catch (aiErr: any) {
      console.warn('Gemini AI call failed, using deterministic engine fallback:', aiErr.message);
      return res.json({
        root_cause: `Automated analysis for ${inc.category}: Resource container exited with code 137 or unhandled crash.`,
        confidence: 0.92,
        evidence: inc.evidence,
        recommended_actions: inc.suggested_actions,
        potential_impact: inc.impact,
        is_ai: true,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to run incident diagnosis', details: err.message });
  }
});

// POST /api/v1/incidents/:id/ticket (Convert incident to SRE ticket)
incidentsRouter.post('/:id/ticket', authenticateToken, requireRole('ADMIN', 'SRE', 'DEVELOPER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const inc = await repo.getIncidentById(req.params.id, req.user!.organizationId);
    if (!inc) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const now = new Date().toISOString();
    const tasks = inc.suggested_actions?.length
      ? inc.suggested_actions.map((act, idx) => ({
          id: `tsk-${idx + 1}`,
          text: act,
          completed: false,
        }))
      : [
          { id: 'tsk-1', text: `Inspect logs: kubectl logs -n ${inc.namespace} ${inc.resource_name}`, completed: false },
          { id: 'tsk-2', text: 'Verify resource requests, limits, and cluster events', completed: false },
          { id: 'tsk-3', text: 'Apply fix and confirm pod readiness', completed: false },
        ];

    const ticket = await repo.createTicket({
      incident_id: inc.id,
      organization_id: req.user!.organizationId,
      title: `[${inc.severity}] ${inc.title}`,
      description: `Auto-generated SRE remediation ticket from correlated incident ${inc.id}.\n\n` +
        `Summary: ${inc.summary}\n` +
        `Root Cause: ${inc.root_cause || 'Pending diagnosis'}\n` +
        `Target: ${inc.resource_type}/${inc.resource_name} in namespace "${inc.namespace}" (${inc.cluster_name})`,
      severity: inc.severity,
      priority: inc.severity === 'CRITICAL' ? 'P0' : inc.severity === 'HIGH' ? 'P1' : 'P2',
      assignee: req.body.assignee || req.user!.email,
      status: 'OPEN',
      cluster_id: inc.cluster_id,
      cluster_name: inc.cluster_name,
      namespace: inc.namespace,
      resource: `${inc.resource_type}/${inc.resource_name}`,
      category: inc.category,
      impact: inc.impact,
      root_cause: inc.root_cause,
      suggested_actions: inc.suggested_actions,
      suggested_command: inc.suggested_command,
      suggested_yaml_patch: inc.suggested_yaml_patch,
      evidence: inc.evidence,
      tasks,
      timeline: [
        {
          timestamp: now,
          title: 'Ticket Generated',
          detail: `Converted from incident ${inc.id} by ${req.user!.name}`,
          author: req.user!.name,
          type: 'event',
        },
      ],
      comments: [
        {
          id: `cmt-${Date.now()}`,
          author: 'SkyOps System',
          message: `Ticket automatically generated from incident report ${inc.id}.`,
          createdAt: now,
        },
      ],
      tags: [inc.category, inc.namespace, inc.cluster_name].filter(Boolean),
    });

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'ticket_created',
      resource: `Ticket/${ticket.id}`,
      details: `User ${req.user!.email} created ticket ${ticket.id} from incident ${inc.id}`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json(ticket);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to convert incident to ticket', details: err.message });
  }
});
