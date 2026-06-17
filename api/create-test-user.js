export default async function handler(req, res) {
  const response = await fetch('https://api.mercadopago.com/users/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ site_id: 'MLA' }),
  });
  const data = await response.json();
  res.status(200).json(data);
}
