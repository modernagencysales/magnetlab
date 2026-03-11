'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Magnet, Loader2, Mail, Lock } from 'lucide-react';
import { Card, CardContent, Button, Input, Label, Separator, Skeleton } from '@magnetlab/magnetui';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackError = searchParams.get('error');
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === 'CredentialsSignin') {
          setError(
            mode === 'signup'
              ? 'Could not create account. This email may already exist — try signing in instead.'
              : 'Invalid email or password'
          );
        } else {
          setError(result.error);
        }
        setLoading(false);
      } else if (result?.ok) {
        router.refresh();
        router.push(callbackUrl);
      } else {
        setError('Login failed. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setLoading(true);
    setError('');
    signIn('google', { callbackUrl });
  };

  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        {/* Sign In / Create Account tabs */}
        <div className="mb-4 flex rounded-md bg-muted p-0.5">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError('');
            }}
            className={`flex-1 rounded py-1.5 text-sm font-medium transition-colors ${
              mode === 'signin'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError('');
            }}
            className={`flex-1 rounded py-1.5 text-sm font-medium transition-colors ${
              mode === 'signup'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Create Account
          </button>
        </div>

        {(error || callbackError) && (
          <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error ||
              (callbackError === 'CredentialsSignin'
                ? 'Invalid email or password'
                : callbackError === 'OAuthAccountNotLinked'
                  ? 'This email is already registered. Please sign in with your password, or use the same method you signed up with.'
                  : `Authentication error: ${callbackError}`)}
          </div>
        )}

        {/* Google OAuth button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>

        <div className="relative my-4">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
            or
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password">{mode === 'signup' ? 'Create a Password' : 'Password'}</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === 'signup' ? 'Choose a password (6+ characters)' : 'Enter your password'
                }
                required
                minLength={6}
                className="pl-9"
              />
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : null}
            {loading
              ? mode === 'signup'
                ? 'Creating account...'
                : 'Signing in...'
              : mode === 'signup'
                ? 'Create Free Account'
                : 'Sign In'}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {mode === 'signin' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-primary underline hover:text-primary/80"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-primary underline hover:text-primary/80"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-6">
      <div className="flex w-full max-w-sm flex-1 min-h-0 flex-col justify-center">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Magnet className="h-5 w-5 text-primary-foreground" />
            </div>
          </Link>
          <h1 className="mt-4 text-xl font-semibold">Welcome to MagnetLab</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create lead magnets your ICP will love</p>
        </div>

        <Suspense
          fallback={
            <Card className="mt-6">
              <CardContent className="p-6">
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          }
        >
          <LoginForm />
        </Suspense>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By signing in, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-foreground">Terms</Link>
          {' '}&{' '}
          <Link href="/privacy" className="underline hover:text-foreground">Privacy</Link>
        </p>
      </div>
    </div>
  );
}
