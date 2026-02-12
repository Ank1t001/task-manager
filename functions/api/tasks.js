export async function onRequest(context) {
  return Response.json({ message: "Tasks API working" });
}