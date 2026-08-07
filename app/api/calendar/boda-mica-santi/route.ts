export async function GET(request: Request) {
  return Response.redirect(new URL("/api/events/mica-santi/calendar", request.url), 307)
}
