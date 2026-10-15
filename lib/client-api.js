export async function api(path, body) {
  const response = await fetch(
    "/api/" + path,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path.startsWith("admin/"))
      window.location.replace("/signin?reason=session-expired");
    throw Object.assign(new Error(result.error || "Request failed."), {
      code: result.code,
      status: response.status,
    });
  }
  return result;
}
