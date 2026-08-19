const Stripe = require('stripe');

const PACK_LABELS = {
  essentiel: 'Essentiel',
  populaire: 'Populaire',
  premium: 'Premium'
};

const PRICE_ENV_KEYS = {
  essentiel: 'STRIPE_PRICE_ESSENTIEL',
  populaire: 'STRIPE_PRICE_POPULAIRE',
  premium: 'STRIPE_PRICE_PREMIUM'
};

function getPriceIdForPack(pack) {
  const envKey = PRICE_ENV_KEYS[pack];
  return envKey ? process.env[envKey] : null;
}

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
    const packLabel = PACK_LABELS[pack];
    const priceId = getPriceIdForPack(pack);

    if (!packLabel) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Pack invalide.' })
      };
    }

    if (!priceId) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Price ID Stripe manquant pour le pack ${packLabel}.` })
      };
    }

    const metadata = Object.entries({
      pack,
      pack_label: packLabel,
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
          price: priceId,
          quantity: 1
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
