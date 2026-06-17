// api/webhook.js
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Validar firma de MP ──────────────────────────────────────
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (secret) {
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];
    const urlParams  = new URLSearchParams(req.url.split('?')[1] || '');
    const dataId     = urlParams.get('data.id') || req.body?.data?.id;

    if (xSignature && xRequestId && dataId) {
      const ts = xSignature.split(',').find(p => p.startsWith('ts='))?.split('=')[1];
      const v1 = xSignature.split(',').find(p => p.startsWith('v1='))?.split('=')[1];
      const signed = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
      const hmac   = crypto.createHmac('sha256', secret).update(signed).digest('hex');
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
    // ── Obtener detalle del pago desde MP ───────────────────────
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    const payment = await mpRes.json();

    const nuevoEstado = payment.status === 'approved' ? 'aprobado'
                      : payment.status === 'rejected'  ? 'rechazado'
                      : 'pendiente';

    const preferenceId = payment.preference_id;
    const userId       = payment.external_reference !== 'guest'
                         ? payment.external_reference
                         : null;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // ── Actualizar el pedido que creamos en create-preference ───
    const { error } = await supabase
      .from('ventas')
      .update({
        estado:     nuevoEstado,
        payment_id: String(paymentId),
        user_id:    userId,           // por si era guest y ahora tenemos el id
      })
      .eq('preference_id', preferenceId);

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(500).json({ error: 'DB update failed' });
    }

    return res.status(200).json({ ok: true, estado: nuevoEstado });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
