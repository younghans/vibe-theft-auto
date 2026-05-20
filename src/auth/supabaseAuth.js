function readRuntimeString(names) {
  for (const name of names) {
    const value = globalThis[name];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function getSupabaseConfig() {
  const url = readRuntimeString([
    'VTA_SUPABASE_URL',
    'STICKRPG_SUPABASE_URL'
  ]);
  const publishableKey = readRuntimeString([
    'VTA_SUPABASE_PUBLISHABLE_KEY',
    'STICKRPG_SUPABASE_PUBLISHABLE_KEY',
    'VTA_SUPABASE_ANON_KEY',
    'STICKRPG_SUPABASE_ANON_KEY'
  ]);
  return { publishableKey, url };
}

function getSupabaseSdkUrl() {
  return readRuntimeString([
    'VTA_SUPABASE_SDK_URL',
    'STICKRPG_SUPABASE_SDK_URL'
  ]) || './node_modules/@supabase/supabase-js/dist/umd/supabase.js';
}

function readGlobalCreateClient() {
  return typeof globalThis.supabase?.createClient === 'function'
    ? globalThis.supabase.createClient
    : null;
}

function loadSupabaseScript() {
  return new Promise((resolve, reject) => {
    const existingCreateClient = readGlobalCreateClient();
    if (existingCreateClient) {
      resolve(existingCreateClient);
      return;
    }

    const existingScript = document.querySelector('[data-vta-supabase-sdk]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        const createClient = readGlobalCreateClient();
        if (createClient) {
          resolve(createClient);
        } else {
          reject(new Error('Supabase browser SDK loaded without createClient.'));
        }
      }, { once: true });
      existingScript.addEventListener('error', () => {
        reject(new Error('Could not load Supabase browser SDK.'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = getSupabaseSdkUrl();
    script.dataset.vtaSupabaseSdk = 'true';
    script.addEventListener('load', () => {
      const createClient = readGlobalCreateClient();
      if (createClient) {
        resolve(createClient);
      } else {
        reject(new Error('Supabase browser SDK loaded without createClient.'));
      }
    }, { once: true });
    script.addEventListener('error', () => {
      reject(new Error('Could not load Supabase browser SDK.'));
    }, { once: true });
    document.head.append(script);
  });
}

async function loadCreateClient() {
  const globalCreateClient = readGlobalCreateClient();
  if (globalCreateClient) {
    return globalCreateClient;
  }

  try {
    const module = await import('@supabase/supabase-js');
    if (typeof module?.createClient === 'function') {
      return module.createClient;
    }
  } catch {
    // Source-mode browser dev falls back to the UMD file from node_modules.
  }

  return loadSupabaseScript();
}

function getSessionEmail(session) {
  return typeof session?.user?.email === 'string' ? session.user.email : '';
}

function getRedirectUrl() {
  try {
    const { origin, pathname, search } = window.location;
    return `${origin}${pathname}${search}`;
  } catch {
    return undefined;
  }
}

function getErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function createState(overrides = {}) {
  return {
    configured: false,
    error: '',
    message: 'Account sync unavailable.',
    session: null,
    status: 'disabled',
    user: null,
    ...overrides
  };
}

export function createSupabaseAuthService() {
  const { publishableKey, url } = getSupabaseConfig();
  const configured = Boolean(url && publishableKey);
  let client = null;
  let clientPromise = null;
  const listeners = new Set();
  let initialized = false;
  let authSubscription = null;
  let state = createState(
    configured
      ? {
        configured: true,
        message: 'Checking account...',
        status: 'loading'
      }
      : {}
  );

  function emit(nextState) {
    state = Object.freeze(createState(nextState));
    for (const listener of listeners) {
      listener(state);
    }
    return state;
  }

  function setSession(session, { status = 'signedOut', message = '' } = {}) {
    const email = getSessionEmail(session);
    return emit({
      configured,
      message: message || (session ? `Signed in as ${email || 'player'}.` : 'Signed out.'),
      session: session ?? null,
      status: session ? 'signedIn' : status,
      user: session?.user ?? null
    });
  }

  async function getClient() {
    if (!configured) {
      return null;
    }
    if (client) {
      return client;
    }
    if (!clientPromise) {
      clientPromise = loadCreateClient().then((createClient) => createClient(url, publishableKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true
        }
      }));
    }
    client = await clientPromise;
    return client;
  }

  return {
    get client() {
      return client;
    },

    getAccessToken() {
      return typeof state.session?.access_token === 'string' ? state.session.access_token : '';
    },

    getState() {
      return state;
    },

    async initialize() {
      if (!configured) {
        return state;
      }

      if (initialized) {
        return state;
      }

      initialized = true;
      let supabaseClient = null;
      try {
        supabaseClient = await getClient();
      } catch (error) {
        initialized = false;
        const message = getErrorMessage(error, 'Could not initialize Supabase auth.');
        return emit({
          configured: true,
          error: message,
          message,
          session: null,
          status: 'error',
          user: null
        });
      }
      if (!supabaseClient) {
        return state;
      }
      const authState = supabaseClient.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });
      authSubscription = authState?.data?.subscription ?? null;

      const { data, error } = await supabaseClient.auth.getSession();
      if (error) {
        return emit({
          configured: true,
          error: error.message,
          message: error.message,
          session: null,
          status: 'error',
          user: null
        });
      }

      return setSession(data?.session ?? null);
    },

    async signInWithEmail(email) {
      if (!configured) {
        return state;
      }

      let supabaseClient = null;
      try {
        supabaseClient = await getClient();
      } catch (error) {
        const message = getErrorMessage(error, 'Could not initialize Supabase auth.');
        return emit({
          ...state,
          error: message,
          message,
          status: 'error'
        });
      }
      if (!supabaseClient) {
        return state;
      }

      const normalizedEmail = String(email ?? '').trim();
      if (!normalizedEmail) {
        return emit({
          ...state,
          error: 'Enter an email address.',
          message: 'Enter an email address.',
          status: 'error'
        });
      }

      emit({
        ...state,
        error: '',
        message: 'Sending sign-in link...',
        status: 'sending'
      });

      const { error } = await supabaseClient.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: getRedirectUrl()
        }
      });
      if (error) {
        return emit({
          ...state,
          error: error.message,
          message: error.message,
          status: 'error'
        });
      }

      return emit({
        ...state,
        error: '',
        message: 'Check your email for the sign-in link.',
        status: 'sent'
      });
    },

    async signInWithGoogle() {
      if (!configured) {
        return state;
      }

      let supabaseClient = null;
      try {
        supabaseClient = await getClient();
      } catch (error) {
        const message = getErrorMessage(error, 'Could not initialize Supabase auth.');
        return emit({
          ...state,
          error: message,
          message,
          status: 'error'
        });
      }
      if (!supabaseClient) {
        return state;
      }

      emit({
        ...state,
        error: '',
        message: 'Opening Google...',
        status: 'redirecting'
      });

      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            prompt: 'select_account'
          },
          redirectTo: getRedirectUrl()
        }
      });
      if (error) {
        return emit({
          ...state,
          error: error.message,
          message: error.message,
          status: 'error'
        });
      }

      return state;
    },

    async signOut() {
      if (!configured) {
        return state;
      }

      let supabaseClient = null;
      try {
        supabaseClient = await getClient();
      } catch (error) {
        const message = getErrorMessage(error, 'Could not initialize Supabase auth.');
        return emit({
          ...state,
          error: message,
          message,
          status: 'error'
        });
      }
      if (!supabaseClient) {
        return state;
      }

      emit({
        ...state,
        error: '',
        message: 'Signing out...',
        status: 'signingOut'
      });

      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        return emit({
          ...state,
          error: error.message,
          message: error.message,
          status: 'error'
        });
      }

      return setSession(null);
    },

    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },

    destroy() {
      authSubscription?.unsubscribe?.();
      authSubscription = null;
      listeners.clear();
    }
  };
}
