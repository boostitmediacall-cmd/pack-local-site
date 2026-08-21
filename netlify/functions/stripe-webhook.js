const Stripe = require('stripe');
const { Resend } = require('resend');

const PACK_PRICES = {
  essentiel: '69€/mois',
  boost: '99€/mois',
  premium: '179€/mois'
};

const GOOGLE_SITUATION_LABELS = {
  existing: 'Fiche Google existante',
  new: 'Creation de fiche Google de zero'
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
      const packPrice = PACK_PRICES[pack] || 'Prix non renseigne';
      const googleSituation = GOOGLE_SITUATION_LABELS[metadata.google_situation] || metadata.google_situation || 'Non renseigne';

      await resend.emails.send({
        from: 'Pack Local <onboarding@resend.dev>',
        to: process.env.OWNER_EMAIL,
        subject: `Nouvelle souscription Pack Local - ${metadata.pack_label || pack}`,
        text: [
          '=== PAIEMENT ===',
          `Pack : ${metadata.pack_label || pack}`,
          `Prix : ${packPrice}`,
          `Email Stripe : ${session.customer_details?.email || 'Non renseigne'}`,
          `Session Stripe : ${session.id}`,
          '',
          '=== CLIENT ===',
          `Nom & prenom : ${metadata.full_name || 'Non renseigne'}`,
          `Etablissement : ${metadata.business_name || 'Non renseigne'}`,
          `Telephone : ${metadata.phone || 'Non renseigne'}`,
          `Ville : ${metadata.city || 'Non renseigne'}`,
          `Code postal : ${metadata.postal_code || 'Non renseigne'}`,
          '',
          '=== FICHE GOOGLE ===',
          `Situation : ${googleSituation}`,
          `Email Google : ${metadata.google_email || 'Non renseigne'}`,
          `Lien fiche Google : ${metadata.google_listing_url || 'Non renseigne'}`,
          `Renonciation retractation : ${metadata.waiver_accepted || 'Non renseigne'}`
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
