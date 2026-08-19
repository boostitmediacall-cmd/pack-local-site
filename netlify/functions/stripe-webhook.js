const Stripe = require('stripe');
const { Resend } = require('resend');

const PACK_PRICES = {
  essentiel: '69€/mois',
  populaire: '99€/mois',
  premium: '179€/mois'
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const resend = new Resend(process.env.RESEND_API_KEY);
    const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const metadata = session.metadata || {};
      const pack = metadata.pack || 'inconnu';
      const packPrice = PACK_PRICES[pack] || metadata.pack_price_eur || 'Prix non renseigne';

      await resend.emails.send({
        from: 'Pack Local <onboarding@resend.dev>',
        to: process.env.OWNER_EMAIL,
        subject: `Nouvelle souscription Pack Local - ${metadata.pack_label || pack}`,
        text: [
          `Pack : ${metadata.pack_label || pack}`,
          `Prix : ${packPrice}`,
          '',
          `Nom : ${metadata.full_name || ''}`,
          `Etablissement : ${metadata.business_name || ''}`,
          `Email : ${metadata.email || session.customer_details?.email || ''}`,
          `Telephone : ${metadata.phone || ''}`,
          `Ville / code postal : ${metadata.location || ''}`,
          `Statut fiche Google : ${metadata.google_listing_status || ''}`,
          `Email compte Google : ${metadata.google_account_email || ''}`,
          `Lien fiche Google : ${metadata.google_listing_url || ''}`
        ].join('\n')
      });
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error) {
    return {
      statusCode: 400,
      body: `Webhook Error: ${error.message}`
    };
  }
};
