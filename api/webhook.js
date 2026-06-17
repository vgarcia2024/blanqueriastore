// api/webhook.js
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validar firma de MP
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (secret) {
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];
    const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
    const dataId = urlParams.get('data.id') || req.body?.data?.id;

    if (xSignature && xRequestId && dataId) {
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${xSignature.split(',').find(p => p.startsWith('ts='))?.split('=')[1]};`;
      const ts = xSignature.split(',').find(p => p.startsWith('ts='))?.split('=')[1];
      const v1 = xSignature.split(',').find(p => p.startsWith('v1='))?.split('=')[1];
      const signed = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
      const hmac = crypto.createHmac('sha256', secret).update(signed).digest('hex');

      if (hmac !== v1) {
        console.warn('Firma inválida');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
  }

  const { type, data } = req.body;

  if (type !== 'payment') {
    return res.status(200).json({ ok: true });
  }

  const paymentId = data?.id;
  if (!paymentId) return res.status(400).json({ error: 'No payment id' });

  try {
    // Obtener detalle del pago desde MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
    });

    const payment = await mpRes.json();

    if (payment.status !== 'approved') {
      return res.status(200).json({ ok: true, status: payment.status });
    }

    const items = payment.additional_info?.items || [];
    const userId = payment.external_reference || null;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    for (const item of items) {
      await supabase.from('ventas').insert({
        user_id: userId,
        producto_id: item.id ? parseInt(item.id) : null,
        cantidad: parseInt(item.quantity) || 1,
        precio_unitario: parseFloat(item.unit_price) || 0,
        total: parseFloat(item.unit_price) * parseInt(item.quantity),
        estado: 'aprobado',
        detalle: item.title,
      });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
