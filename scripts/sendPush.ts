import webpush from "web-push";

// suas chaves VAPID
const vapidKeys = {
  publicKey: "BNqj276kNGDlNaWysnY6s18qm0xRm99BJaiVMLJDf6aREWs7ztGebpmE12Fj3zOuwvdCSUKYXgKC2WGoq-sc-hU",
  privateKey: "pOPuySt72NIkkc1bylPYhnJZOW5f3SVD04cLYEj4fZg" // ⚠️ troque pela gerada
};

webpush.setVapidDetails(
  "mailto:clivtecnologia@gmail.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// sua subscription
const subscription = {
  "endpoint": "https://web.push.apple.com/QO6PuVroqkBcttsfKT7ewr6D2NViW9bPIInrkftBQ9EBGO4q1xK2wfY2lZfrHY81brk8Lc9hpVJcS55pGkAs_Pl7sLSqWYDuvsfRRX6fPCrPWzrtfKYKWAztmCGkWKqAxdWSlNkJWwrwB1Kflq5chnqj5EhidTjYfCjv3hN3wqM",
  "expirationTime": null,
  "keys": {
    "p256dh": "BC6kDtA0qwPFq4LSmqPaqZtAcB6dhDiUAQXK4CPyzCMYD-vF-B597bwzSZzW3YDNWeufs-_RLAjgZm6rLlUYuMU",
    "auth": "SadPiXFV9hXYcg2FeJLvnQ"
  }
};

// payload de teste
const payload = JSON.stringify({
  title: "ISAC - Fique bem informado",
  body: "Dor, inchaço ou veias endurecidas? Pode ser trombose!",
  icon: "/favicon-32x32.png",
  badge: "/favicon-32x32.png",
  url: "/noticias"
});

// enviar
webpush.sendNotification(subscription, payload)
  .then(() => console.log("✅ Push enviada com sucesso"))
  .catch(err => {
  console.error("❌ Erro ao enviar push");
  console.error("statusCode:", err.statusCode);
  console.error("headers:", err.headers);
  console.error("body:", err.body);
});

