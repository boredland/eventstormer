export async function verifyTurnstileToken(
  token: string | null | undefined,
  ip: string,
  secretKey: string | undefined
): Promise<boolean> {
  // Clean bypass when secret key is not configured (e.g. local dev setup)
  if (!secretKey || secretKey.trim() === '') {
    return true;
  }

  if (!token) {
    return false;
  }

  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const outcome = (await result.json()) as { success: boolean; 'error-codes'?: string[] };
    return outcome.success === true;
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return false;
  }
}
