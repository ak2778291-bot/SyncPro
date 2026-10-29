// Renders the real Google Identity button when VITE_GOOGLE_CLIENT_ID is set,
// otherwise a disabled placeholder so email/password still works without config.
import { GoogleLogin } from "@react-oauth/google";

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
export const googleEnabled = GOOGLE_CLIENT_ID.length > 0;

type Props = {
  onCredential: (credential: string) => void;
  onError?: (message: string) => void;
};

export default function GoogleAuthButton({ onCredential, onError }: Props) {
  if (!googleEnabled) {
    return (
      <button
        type="button"
        disabled
        title="Set VITE_GOOGLE_CLIENT_ID in the frontend .env to enable Google sign-in"
        className="w-full flex items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
      >
        <GoogleGlyph />
        Continue with Google
        <span className="ml-1 text-[10px] uppercase tracking-wide text-gray-600">(not configured)</span>
      </button>
    );
  }

  return (
    <div className="flex justify-center [color-scheme:light]">
      <GoogleLogin
        theme="filled_black"
        size="large"
        text="continue_with"
        width="320"
        onSuccess={(res) => {
          if (res.credential) onCredential(res.credential);
          else onError?.("Google did not return a credential.");
        }}
        onError={() => onError?.("Google sign-in failed. Please try again.")}
      />
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
