// api/create-preference.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'No items provided' });
  }

  const preference = {
    items: items.map(item => ({
      title: item.nombre,
      quantity: item.cantidad,
      unit_price: parseFloat(item.precio),
      currency_id: 'ARS',
    })),
    back_urls: {
      success: 'https://blanqueriastore.vercel.app/pages/pago-exitoso.html',
      failure: 'https://blanqueriastore.vercel.app/pages/pago-fallido.html',
      pending: 'https://blanqueriastore.vercel.app/pages/pago-exitoso.html',
    },
    auto_return: 'approved',
  };

  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('MP error:', data);
      return res.status(500).json({ error: 'Error creando preferencia', detail: data });
    }

    // init_point = producción, sandbox_init_point = pruebas
    return res.status(200).json({
      init_point: data.sandbox_init_point, // ← cambiá a data.init_point cuando vayas a producción
      preference_id: data.id,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
}
