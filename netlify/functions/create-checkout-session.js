const Stripe = require('stripe');

const PACK_LABELS = {
  essentiel: 'Essentiel',
  boost: 'Boost',
  premium: 'Premium'
};

const PRICE_ENV_KEYS = {
  essentiel: 'STRIPE_PRICE_ESSENTIEL',
  boost: 'STRIPE_PRICE_BOOST',
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
    const { pack } = JSON.parse(event.body || '{}');
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

    const origin = event.headers.origin || `https://${event.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'subscription',
      return_url: `${origin}/merci.html?pack=${pack}&session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        pack,
        pack_label: packLabel
      },
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
