/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API: Get AI insights from Gemini API (Server-side proxy)
  app.post('/api/gemini/analyze', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(200).json({
          error: true,
          message: {
            ar: '⚠️ لم يتم تهيئة مفتاح جيميناي (GEMINI_API_KEY) في السيرفر بعد. تفضل بزيارة الإعدادات لإضافته.',
            en: '⚠️ Gemini API Key (GEMINI_API_KEY) is not configured in the server environment yet.',
            fr: '⚠️ La clé API Gemini (GEMINI_API_KEY) n\'est pas encore configurée sur le serveur.'
          }
        });
      }

      const { products, sales, expenses, lang } = req.body;

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemPrompt = `
You are an expert AI business intelligence copilot for Algerian retail and smart phone shops ("DzStore").
Analyze the current stock data, cashier sales and operational expenses provided by the merchant, and output a concise summary in Arabic (and optional French keywords) outlining:
1. Suggested selling prices with higher margins.
2. Comprehensive income analysis, comparing gross profit (sales - buying costs) to rent, electricity, and salary expenses, determining exact Net profit.
3. Accurate stock shortage predictions (which models will run out soon based on current levels and minimum alerts).
4. Auto-generated restocking order suggestions to submit to suppliers.

Format your output in professional Markdown format. Keep the summary highly actionable and relevant to Algerian Dinars (DZD). Use tables where appropriate.
      `;

      const userPrompt = `
Merchant Data:
- Language request: ${lang || 'ar'}
- Total Cashier Sales count: ${sales?.length || 0}
- Current Inventory count: ${products?.length || 0}
- Total Expenses listed: ${expenses?.length || 0}

Detailed Products list:
${JSON.stringify(products?.slice(0, 40).map((p: any) => ({ name: p.name, brand: p.brand, quantity: p.quantity, purchasePrice: p.purchasePrice, sellingPrice: p.sellingPrice, minQuantity: p.minQuantity })) || '')}

Detailed Sales list:
${JSON.stringify(sales?.slice(0, 30).map((s: any) => ({ total: s.total, items: s.items.map((i: any) => ({ name: i.name, qty: i.quantity, price: i.price })) })) || '')}

Detailed Operating Expenses list:
${JSON.stringify(expenses?.slice(0, 30) || '')}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        }
      });

      const analysisText = response.text || "No response received";
      return res.json({ success: true, analysis: analysisText });

    } catch (err: any) {
      console.error("Gemini copilot analysis failed:", err);
      return res.status(500).json({
        error: true,
        message: err.message || "Internal server error"
      });
    }
  });

  // API: Interactive AI Shop Assistant Chat Proxy
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          error: true,
          message: {
            ar: '⚠️ لم يتم تهيئة مفتاح جيميناي (GEMINI_API_KEY) في السيرفر بعد. يرجى تهيئته عبر لوحة التحكم.',
            en: '⚠️ Gemini API Key (GEMINI_API_KEY) is not configured in the server environment yet.',
            fr: '⚠️ La clé API Gemini (GEMINI_API_KEY) n\'est pas encore configurée.'
          }
        });
      }

      const { message, products, sales, expenses, spareParts, maintenanceJobs, bookings, lang } = req.body;

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemPrompt = `
You are the interactive AI Merchant Advisor for "DzStore" (Algerian Point of Sale and Repairs App/SaaS).
You are consulting the merchant who operates a smartphone sales, hardware parts, repair, and electronics store.

Live Store Dataset Metadata:
- Active Inventory Products: ${products?.length || 0} items
- Cashier Sales count: ${sales?.length || 0} receipts
- Operating Expenses listed: ${expenses?.length || 0} listings
- Repair Jobs total: ${maintenanceJobs?.length || 0} tickets
- Active Booking Requests: ${bookings?.length || 0} items
- Spare Parts level: ${spareParts?.length || 0} parts

Real-time Store Data Snapshots:
- Inventory: ${JSON.stringify((products || []).slice(0, 15).map((p: any) => ({ name: p.name, brand: p.brand, qty: p.quantity, cost: p.purchasePrice, price: p.sellingPrice, min: p.minQuantity })))}
- Sales Records: ${JSON.stringify((sales || []).slice(0, 15).map((s: any) => ({ invoice: s.invoiceNumber, total: s.total, cashier: s.cashierName, items: s.items.map((i: any) => ({ name: i.name, qty: i.quantity, price: i.price, cost: i.cost })) })))}
- Expense items: ${JSON.stringify((expenses || []).slice(0, 15))}
- Spare Parts stock: ${JSON.stringify((spareParts || []).slice(0, 15).map((p: any) => ({ name: p.name, model: p.model, qty: p.quantity, price: p.sellingPrice })))}
- Active Repair Tickets: ${JSON.stringify((maintenanceJobs || []).slice(0, 15).map((j: any) => ({ ticket: j.ticketNumber, status: j.status, finalCost: j.finalCost, model: j.deviceModel, tech: j.technicianName })))}

Your Instructions:
- Answer the merchant's query regarding their shop with high precision, professional commercial insight, and absolute clarity.
- Keep the language matched to the merchant's intent: Arabic (Algerian/Standard Arabic is highly preferred) or French or English.
- Be able to calculate live profits on the fly:
  - Profit per invoice = total - sum(item.cost * item.quantity).
  - Profit per product = sell_price - cost.
  - Overall Gross profit, net profit (sales profit + repair profit - expenses).
- Give smart alerts on depleted inventory parts or products (current qty <= min qty).
- Give smart suggestions about best selling products or technician performance.
Format your reply beautifully in rich Markdown layout, with professional scannable headings, bullet points, and tables. Keep numbers in Algerian Dinars (DZD).
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `User Merchant query: "${message}"\nPreferred Language: ${lang || 'ar'}`,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.4,
        }
      });

      return res.json({ success: true, reply: response.text || "No response" });

    } catch (err: any) {
      console.error("Gemini assistant chat failed:", err);
      return res.status(500).json({
        error: true,
        message: err.message || "Internal server error"
      });
    }
  });

  // Serve Vite in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DzStore Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
