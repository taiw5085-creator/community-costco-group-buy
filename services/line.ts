export type LineReplyPayload = {
  userId?: string;
  message: string;
};

export async function sendLineMessage(userIdOrPayload: string | LineReplyPayload | null | undefined, message?: string) {
  const payload =
    typeof userIdOrPayload === "object" && userIdOrPayload !== null
      ? userIdOrPayload
      : { userId: userIdOrPayload ?? undefined, message: message ?? "" };

  // Reserved for LINE Messaging API integration.
  console.log("[LINE placeholder]", payload.userId ?? "unbound-user", payload.message);
  return {
    ok: true
  };
}
