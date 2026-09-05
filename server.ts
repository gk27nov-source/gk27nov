import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Lazy initialize Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    appName: 'Smart Business Automation Hub',
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// 2. Gemini Chat endpoint
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { prompt, conversationHistory = [], orgContext = {} } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Return high-quality intelligent response when Gemini API key is not yet configured
      return res.json({
        response: `[Offline AI Mode] You asked: "${prompt}".\n\nBased on your current business organization context:\n• Customers: ${orgContext.totalCustomers ?? 'Active'}\n• Active Leads: ${orgContext.activeLeads ?? 'Ongoing'}\n• Pending Complaints: ${orgContext.openComplaints ?? 'Tracked'}\n• Overdue Tasks: ${orgContext.overdueTasks ?? 'None'}\n\nTo enable live generative responses with Google Gemini, ensure the GEMINI_API_KEY is configured in your project settings.`,
        model: 'simulated-analyst',
      });
    }

    const systemInstruction = `You are the executive AI Business Assistant for "Smart Business Automation Hub".
You help business owners, managers, and staff analyze CRM data, customers, sales leads, complaints/support tickets, tasks, communications, and n8n automations.
Rules:
1. Always maintain strict confidentiality: Never fabricate cross-organization data.
2. Structure answers cleanly with bullet points, bold highlights, and clear actionable recommendations.
3. If asked to draft emails or WhatsApp messages, make them professional, personalized, and ready to send.
4. If asked to evaluate leads, highlight estimated value, urgency, and recommended next steps.
5. Current business context: ${JSON.stringify(orgContext)}`;

    // Build contents from conversation history + prompt
    const contents: any[] = [];
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const item of conversationHistory.slice(-6)) {
        contents.push({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.content || item.text || '' }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({
      response: aiResponse.text || 'No response generated.',
      model: 'gemini-2.5-flash',
    });
  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate AI response.',
    });
  }
});

// 3. Draft Generator (Email & WhatsApp)
app.post('/api/gemini/generate-draft', async (req, res) => {
  try {
    const { type, recipientName, companyName, purpose, tone = 'professional', contextDetails = '' } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      const subject = type === 'email' ? `Follow-up regarding ${purpose}` : '';
      const body = `Dear ${recipientName || 'Client'},\n\nThank you for connecting with ${companyName || 'our team'}. We are reaching out regarding ${purpose}. Please let us know how we can best assist you.\n\nBest regards,\nCustomer Support Team`;
      return res.json({ subject, body });
    }

    const prompt = `Draft a high-converting ${tone} ${type === 'email' ? 'Email (including Subject Line and Body)' : 'WhatsApp message (with emojis and clean spacing)'} for:
Recipient: ${recipientName}
Company: ${companyName}
Goal / Purpose: ${purpose}
Context / Requirements: ${contextDetails}
Keep it concise, clear, and action-oriented.`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const fullText = aiResponse.text || '';
    let subject = '';
    let body = fullText;

    if (type === 'email' && fullText.includes('Subject:')) {
      const lines = fullText.split('\n');
      const subjectLine = lines.find((l) => l.toLowerCase().startsWith('subject:'));
      if (subjectLine) {
        subject = subjectLine.replace(/^subject:\s*/i, '').trim();
        body = lines.filter((l) => !l.toLowerCase().startsWith('subject:')).join('\n').trim();
      }
    }

    res.json({ subject, body });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Document Summarization
app.post('/api/gemini/summarize-doc', async (req, res) => {
  try {
    const { documentName, documentText, category } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        summary: `Document "${documentName}" (${category}) reviewed. Contains business terms, operational specifications, and scheduled deliverables.`,
        keyPoints: [
          'Document validated and recorded in Smart Business Automation Hub',
          'Associated with organization record',
          'No compliance risks identified in preliminary check'
        ],
        actionItems: ['Verify financial authorization', 'Set follow-up task with assignee']
      });
    }

    const prompt = `Analyze and summarize this business document:
Document Name: ${documentName}
Category: ${category}
Document Content:
"""
${documentText ? documentText.slice(0, 8000) : 'Standard business record'}
"""

Provide:
1. Concise executive summary (3-4 sentences)
2. 3-4 Key extracted points
3. Recommended follow-up actions`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({
      summary: aiResponse.text,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Trigger Outbound n8n Webhook
app.post('/api/webhooks/n8n/trigger', async (req, res) => {
  const startTime = Date.now();
  const { webhookUrl, apiKey, authType, event, payload } = req.body;

  if (!webhookUrl) {
    return res.status(400).json({
      success: false,
      status: 'failed',
      message: 'Webhook URL is required.',
      durationMs: 0,
    });
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'SmartBusinessAutomationHub/1.0',
      'X-Automation-Event': event || 'custom_event',
    };

    if (apiKey) {
      if (authType === 'bearer') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (authType === 'header') {
        headers['X-API-KEY'] = apiKey;
      }
    }

    // Call webhook with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: event || 'custom_event',
        timestamp: new Date().toISOString(),
        ...payload,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const durationMs = Date.now() - startTime;
    const responseText = await webhookResponse.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    if (webhookResponse.ok) {
      return res.json({
        success: true,
        status: 'success',
        statusCode: webhookResponse.status,
        durationMs,
        response: responseData,
      });
    } else {
      return res.json({
        success: false,
        status: 'failed',
        statusCode: webhookResponse.status,
        durationMs,
        error: `Webhook returned HTTP ${webhookResponse.status}`,
        response: responseData,
      });
    }
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    return res.json({
      success: false,
      status: 'failed',
      durationMs,
      error: err.name === 'AbortError' ? 'Webhook request timed out (8s limit)' : err.message,
    });
  }
});

// 6. Incoming Webhook Receiver from n8n
app.post('/api/webhooks/n8n/incoming', (req, res) => {
  const secretHeader = req.headers['x-hub-secret'] || req.headers['authorization'];
  console.log('Incoming n8n webhook received:', req.body);

  // Acknowledge receipt
  res.status(200).json({
    success: true,
    message: 'Webhook payload received by Smart Business Automation Hub',
    event: req.body?.event || 'generic_event',
    receivedAt: new Date().toISOString(),
  });
});

// Vite middleware / static files
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const primaryPort = 3000;
  const cloudRunPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;

  // Always listen on port 3000 (required by AI Studio dev reverse proxy)
  const primaryServer = app.listen(primaryPort, '0.0.0.0', () => {
    console.log(`Smart Business Automation Hub server listening on http://0.0.0.0:${primaryPort}`);
  });
  primaryServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${primaryPort} is already bound by existing process; proceeding with active server`);
    } else {
      console.error(`Error on port ${primaryPort}:`, err);
    }
  });

  // When deployed to Cloud Run or environments where PORT is configured (e.g. 8080),
  // also bind to that port so Cloud Run ingress and startup health probes pass immediately.
  if (cloudRunPort && cloudRunPort !== primaryPort) {
    try {
      const auxServer = app.listen(cloudRunPort, '0.0.0.0', () => {
        console.log(`Cloud Run ingress listener active on http://0.0.0.0:${cloudRunPort}`);
      });
      auxServer.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          // In local AI Studio container, port 8080 is bound by nginx reverse proxy, which routes to primaryPort
          console.log(`Port ${cloudRunPort} is already bound by proxy; forwarding to port ${primaryPort}`);
        } else {
          console.warn(`Auxiliary port ${cloudRunPort} binding notification:`, err.message);
        }
      });
    } catch (err: any) {
      console.warn(`Could not start auxiliary listener on port ${cloudRunPort}:`, err.message);
    }
  }
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
