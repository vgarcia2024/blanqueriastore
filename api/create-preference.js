// api/create-preference.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items, userId } = req.body;
  if (!items || !items.length) {
    return res.status(400).json({ error: 'No items provided' });
  }

  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  // ── 1. Crear preferencia en MP ──────────────────────────────
  const preference = {
    items: items.map(item => ({
      id:         String(item.id),
      title:      item.nombre,
      quantity:   item.cantidad,
      unit_price: parseFloat(item.precio),
      currency_id: 'ARS',
    })),
    external_reference: userId || 'guest',
    back_urls: {
      success: 'https://blanqueriastore.vercel.app/pages/pago-exitoso.html',
      failure: 'https://blanqueriastore.vercel.app/pages/pago-fallido.html',
      pending: 'https://blanqueriastore.vercel.app/pages/pago-exitoso.html',
    },
    auto_return: 'approved',
    notification_url: 'https://blanqueriastore.vercel.app/api/webhook',
  };

  try {
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error('MP error:', mpData);
      return res.status(500).json({ error: 'Error creando preferencia', detail: mpData });
    }

    const preferenceId = mpData.id;

    // ── 2. Guardar pedido pendiente en Supabase ──────────────
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { error: dbError } = await supabase.from('ventas').insert({
      user_id:       userId || null,
      preference_id: preferenceId,
      estado:        'pendiente',
      total:         total,
      // Guardamos los items como JSON para que el webhook los recupere
      items:         items.map(i => ({
        producto_id:   i.id,
        nombre:        i.nombre,
        cantidad:      i.cantidad,
        precio_unitario: i.precio,
      })),
    });

    if (dbError) {
      console.error('Supabase insert error:', dbError);
      // No bloqueamos el pago si falla el insert, pero lo logueamos
    }

    return res.status(200).json({
      init_point:    mpData.sandbox_init_point,
      preference_id: preferenceId,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
}
