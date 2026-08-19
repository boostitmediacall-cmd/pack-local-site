const Stripe = require('stripe');

const PACKS = {
  essentiel: { label: 'Essentiel', amount: 6900 },
  populaire: { label: 'Populaire', amount: 9900 },
  premium: { label: 'Premium', amount: 17900 }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { pack, formData = {} } = JSON.parse(event.body || '{}');
    const selectedPack = PACKS[pack];

    if (!selectedPack) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Pack invalide.' })
      };
    }

    const metadata = Object.entries({
      pack,
      pack_label: selectedPack.label,
      pack_price_eur: String(selectedPack.amount / 100),
      ...formData
    }).reduce((acc, [key, value]) => {
      if (typeof value === 'string' && value.trim()) {
        acc[key] = value.trim().slice(0, 500);
      }
      return acc;
    }, {});

    const origin = event.headers.origin || `https://${event.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'subscription',
      return_url: `${origin}/merci.html?pack=${pack}&session_id={CHECKOUT_SESSION_ID}`,
      customer_email: formData.email || undefined,
      metadata,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: selectedPack.amount,
            recurring: { interval: 'month' },
            product_data: {
              name: `Pack Local ${selectedPack.label}`,
              description: `Abonnement mensuel Pack Local ${selectedPack.label}`
            }
          }
        }
      ]
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_secret: session.client_secret })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Impossible de creer la session Stripe.' })
    };
  }
};
