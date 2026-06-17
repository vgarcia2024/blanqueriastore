// api/webhook.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, data } = req.body;

  // MP manda distintos tipos de notificación, solo nos interesan los pagos
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

    // Solo procesamos pagos aprobados
    if (payment.status !== 'approved') {
      return res.status(200).json({ ok: true, status: payment.status });
    }

    // Extraer items del pago
    const items = payment.additional_info?.items || [];
    const userId = payment.external_reference || null; // lo vamos a mandar desde el frontend

    // Guardar en Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY // service key, no la anon key
    );

    // Insertar una venta por cada item
    for (const item of items) {
      await supabase.from('ventas').insert({
        user_id: userId,
        producto_id: item.id || null,
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
