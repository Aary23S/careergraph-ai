export async function createNotification(models, payload) {
  return models.Notification.create(payload);
}
