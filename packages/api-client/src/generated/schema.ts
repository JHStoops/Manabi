/**
 * GENERATED FILE: do not edit. Run `npm run generate:client` after changing an API route.
 * Types for every /api/v1 route, from packages/api-client/openapi.json (openapi-typescript).
 */

export interface paths {
  '/api/v1/healthz': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** API and database status */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              /** @enum {string} */
              status: 'ok';
              /** @enum {string} */
              api: 'ok';
              /** @enum {string} */
              database: 'ok';
            };
          };
        };
        /** @description Default Response */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/login': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Sign in by username or email and password */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': {
            identifier: string;
            password: string;
            /**
             * @default web
             * @enum {string}
             */
            clientKind?: 'web' | 'mobile';
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              user: {
                id: number;
                username: string;
                email: string | null;
                displayName: string;
                /** @enum {string} */
                role: 'admin' | 'learner';
                mustChangePassword: boolean;
                timeZone: string;
                settings: {
                  /** @default null */
                  avatarColor: string | null;
                  /** @default null */
                  avatarInitial: string | null;
                  /** @default 20 */
                  dailyGoal: 10 | 20 | 30 | 50;
                  /** @default 20 */
                  newItemCap: number;
                  /** @default 100 */
                  reviewCap: number;
                  /** @default true */
                  drawingExercises: boolean;
                  /** @default false */
                  preferWordBank: boolean;
                  /**
                   * @default sakura
                   * @enum {string}
                   */
                  theme: 'sakura' | 'matcha' | 'umi' | 'yuyake' | 'sumi';
                  /**
                   * @default system
                   * @enum {string}
                   */
                  colorMode: 'system' | 'light' | 'dark';
                  /**
                   * @default unlearned
                   * @enum {string}
                   */
                  readingAnnotations: 'always' | 'unlearned' | 'never';
                  /**
                   * @default normal
                   * @enum {string}
                   */
                  targetTextSize: 'normal' | 'large';
                  /** @default true */
                  soundEffects: boolean;
                  /** @default true */
                  audioAutoplay: boolean;
                  /** @default false */
                  reducedMotion: boolean;
                  /** @default true */
                  appearOnLeaderboard: boolean;
                  /** @default true */
                  allowNudges: boolean;
                };
                /** Format: date-time */
                disabledAt: string | null;
              };
              token?: string;
            };
          };
        };
        /** @description Default Response */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        429: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/accept-invite': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Create an account from an invite and sign in */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': {
            token: string;
            username: string;
            displayName: string;
            password: string;
            email?: string;
            dailyGoal: 10 | 20 | 30 | 50;
            /** @default UTC */
            timeZone?: string;
            /**
             * @default web
             * @enum {string}
             */
            clientKind?: 'web' | 'mobile';
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              user: {
                id: number;
                username: string;
                email: string | null;
                displayName: string;
                /** @enum {string} */
                role: 'admin' | 'learner';
                mustChangePassword: boolean;
                timeZone: string;
                settings: {
                  /** @default null */
                  avatarColor: string | null;
                  /** @default null */
                  avatarInitial: string | null;
                  /** @default 20 */
                  dailyGoal: 10 | 20 | 30 | 50;
                  /** @default 20 */
                  newItemCap: number;
                  /** @default 100 */
                  reviewCap: number;
                  /** @default true */
                  drawingExercises: boolean;
                  /** @default false */
                  preferWordBank: boolean;
                  /**
                   * @default sakura
                   * @enum {string}
                   */
                  theme: 'sakura' | 'matcha' | 'umi' | 'yuyake' | 'sumi';
                  /**
                   * @default system
                   * @enum {string}
                   */
                  colorMode: 'system' | 'light' | 'dark';
                  /**
                   * @default unlearned
                   * @enum {string}
                   */
                  readingAnnotations: 'always' | 'unlearned' | 'never';
                  /**
                   * @default normal
                   * @enum {string}
                   */
                  targetTextSize: 'normal' | 'large';
                  /** @default true */
                  soundEffects: boolean;
                  /** @default true */
                  audioAutoplay: boolean;
                  /** @default false */
                  reducedMotion: boolean;
                  /** @default true */
                  appearOnLeaderboard: boolean;
                  /** @default true */
                  allowNudges: boolean;
                };
                /** Format: date-time */
                disabledAt: string | null;
              };
              token?: string;
            };
          };
        };
        /** @description Default Response */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        429: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/logout': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Sign out this session */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': Record<string, never> | null;
        };
      };
      responses: {
        /** @description Default Response */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/change-password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Choose a new password; signs out every other session */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': {
            currentPassword: string;
            newPassword: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              user: {
                id: number;
                username: string;
                email: string | null;
                displayName: string;
                /** @enum {string} */
                role: 'admin' | 'learner';
                mustChangePassword: boolean;
                timeZone: string;
                settings: {
                  /** @default null */
                  avatarColor: string | null;
                  /** @default null */
                  avatarInitial: string | null;
                  /** @default 20 */
                  dailyGoal: 10 | 20 | 30 | 50;
                  /** @default 20 */
                  newItemCap: number;
                  /** @default 100 */
                  reviewCap: number;
                  /** @default true */
                  drawingExercises: boolean;
                  /** @default false */
                  preferWordBank: boolean;
                  /**
                   * @default sakura
                   * @enum {string}
                   */
                  theme: 'sakura' | 'matcha' | 'umi' | 'yuyake' | 'sumi';
                  /**
                   * @default system
                   * @enum {string}
                   */
                  colorMode: 'system' | 'light' | 'dark';
                  /**
                   * @default unlearned
                   * @enum {string}
                   */
                  readingAnnotations: 'always' | 'unlearned' | 'never';
                  /**
                   * @default normal
                   * @enum {string}
                   */
                  targetTextSize: 'normal' | 'large';
                  /** @default true */
                  soundEffects: boolean;
                  /** @default true */
                  audioAutoplay: boolean;
                  /** @default false */
                  reducedMotion: boolean;
                  /** @default true */
                  appearOnLeaderboard: boolean;
                  /** @default true */
                  allowNudges: boolean;
                };
                /** Format: date-time */
                disabledAt: string | null;
              };
              token?: string;
            };
          };
        };
        /** @description Default Response */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        429: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/password-reset': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Email a password-reset link (needs SMTP); answers alike for unknown accounts */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': {
            identifier: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': null;
          };
        };
        /** @description Default Response */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        429: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/auth/password-reset/confirm': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Choose a new password with an emailed reset token; signs out every session */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': {
            token: string;
            newPassword: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Default Response */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        429: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/me': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** The signed-in user */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              id: number;
              username: string;
              email: string | null;
              displayName: string;
              /** @enum {string} */
              role: 'admin' | 'learner';
              mustChangePassword: boolean;
              timeZone: string;
              settings: {
                /** @default null */
                avatarColor: string | null;
                /** @default null */
                avatarInitial: string | null;
                /** @default 20 */
                dailyGoal: 10 | 20 | 30 | 50;
                /** @default 20 */
                newItemCap: number;
                /** @default 100 */
                reviewCap: number;
                /** @default true */
                drawingExercises: boolean;
                /** @default false */
                preferWordBank: boolean;
                /**
                 * @default sakura
                 * @enum {string}
                 */
                theme: 'sakura' | 'matcha' | 'umi' | 'yuyake' | 'sumi';
                /**
                 * @default system
                 * @enum {string}
                 */
                colorMode: 'system' | 'light' | 'dark';
                /**
                 * @default unlearned
                 * @enum {string}
                 */
                readingAnnotations: 'always' | 'unlearned' | 'never';
                /**
                 * @default normal
                 * @enum {string}
                 */
                targetTextSize: 'normal' | 'large';
                /** @default true */
                soundEffects: boolean;
                /** @default true */
                audioAutoplay: boolean;
                /** @default false */
                reducedMotion: boolean;
                /** @default true */
                appearOnLeaderboard: boolean;
                /** @default true */
                allowNudges: boolean;
              };
              /** Format: date-time */
              disabledAt: string | null;
            };
          };
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/me/sessions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** The signed-in user's active sessions */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              sessions: {
                id: number;
                /** @enum {string} */
                clientKind: 'web' | 'mobile';
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                lastSeenAt: string;
                /** Format: date-time */
                expiresAt: string;
                current: boolean;
              }[];
            };
          };
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/me/sessions/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Revoke one of your sessions */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/users': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Every user with role, last active day and streak */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              users: {
                id: number;
                username: string;
                email: string | null;
                displayName: string;
                /** @enum {string} */
                role: 'admin' | 'learner';
                mustChangePassword: boolean;
                timeZone: string;
                settings: {
                  /** @default null */
                  avatarColor: string | null;
                  /** @default null */
                  avatarInitial: string | null;
                  /** @default 20 */
                  dailyGoal: 10 | 20 | 30 | 50;
                  /** @default 20 */
                  newItemCap: number;
                  /** @default 100 */
                  reviewCap: number;
                  /** @default true */
                  drawingExercises: boolean;
                  /** @default false */
                  preferWordBank: boolean;
                  /**
                   * @default sakura
                   * @enum {string}
                   */
                  theme: 'sakura' | 'matcha' | 'umi' | 'yuyake' | 'sumi';
                  /**
                   * @default system
                   * @enum {string}
                   */
                  colorMode: 'system' | 'light' | 'dark';
                  /**
                   * @default unlearned
                   * @enum {string}
                   */
                  readingAnnotations: 'always' | 'unlearned' | 'never';
                  /**
                   * @default normal
                   * @enum {string}
                   */
                  targetTextSize: 'normal' | 'large';
                  /** @default true */
                  soundEffects: boolean;
                  /** @default true */
                  audioAutoplay: boolean;
                  /** @default false */
                  reducedMotion: boolean;
                  /** @default true */
                  appearOnLeaderboard: boolean;
                  /** @default true */
                  allowNudges: boolean;
                };
                /** Format: date-time */
                disabledAt: string | null;
                /** Format: date */
                lastActiveDate: string | null;
                currentStreak: number;
                /** Format: date-time */
                createdAt: string;
              }[];
            };
          };
        };
        /** @description Default Response */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/users/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** Change a user's role, or disable (signing them out) or re-enable the account */
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': {
            /** @enum {string} */
            role?: 'admin' | 'learner';
            disabled?: boolean;
          };
        };
      };
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              id: number;
              username: string;
              email: string | null;
              displayName: string;
              /** @enum {string} */
              role: 'admin' | 'learner';
              mustChangePassword: boolean;
              timeZone: string;
              settings: {
                /** @default null */
                avatarColor: string | null;
                /** @default null */
                avatarInitial: string | null;
                /** @default 20 */
                dailyGoal: 10 | 20 | 30 | 50;
                /** @default 20 */
                newItemCap: number;
                /** @default 100 */
                reviewCap: number;
                /** @default true */
                drawingExercises: boolean;
                /** @default false */
                preferWordBank: boolean;
                /**
                 * @default sakura
                 * @enum {string}
                 */
                theme: 'sakura' | 'matcha' | 'umi' | 'yuyake' | 'sumi';
                /**
                 * @default system
                 * @enum {string}
                 */
                colorMode: 'system' | 'light' | 'dark';
                /**
                 * @default unlearned
                 * @enum {string}
                 */
                readingAnnotations: 'always' | 'unlearned' | 'never';
                /**
                 * @default normal
                 * @enum {string}
                 */
                targetTextSize: 'normal' | 'large';
                /** @default true */
                soundEffects: boolean;
                /** @default true */
                audioAutoplay: boolean;
                /** @default false */
                reducedMotion: boolean;
                /** @default true */
                appearOnLeaderboard: boolean;
                /** @default true */
                allowNudges: boolean;
              };
              /** Format: date-time */
              disabledAt: string | null;
              /** Format: date */
              lastActiveDate: string | null;
              currentStreak: number;
              /** Format: date-time */
              createdAt: string;
            };
          };
        };
        /** @description Default Response */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    trace?: never;
  };
  '/api/v1/admin/users/{id}/temporary-password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Set a temporary password (7 days, must be changed at sign-in); signs them out */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': {
            password: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Default Response */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/invites': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Every invite, newest first */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              invites: {
                id: number;
                email: string | null;
                /** @enum {string} */
                role: 'admin' | 'learner';
                /** @enum {string} */
                status: 'pending' | 'used' | 'revoked' | 'expired';
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                expiresAt: string;
              }[];
            };
          };
        };
        /** @description Default Response */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    put?: never;
    /** Create an invite; returns its link and emails it when SMTP and an address are set */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': {
            /**
             * @default learner
             * @enum {string}
             */
            role?: 'admin' | 'learner';
            email?: string;
            /** @default 7 */
            expiresInDays?: number;
          };
        };
      };
      responses: {
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              invite: {
                id: number;
                email: string | null;
                /** @enum {string} */
                role: 'admin' | 'learner';
                /** @enum {string} */
                status: 'pending' | 'used' | 'revoked' | 'expired';
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                expiresAt: string;
              };
              /** Format: uri */
              link: string;
              emailed: boolean;
            };
          };
        };
        /** @description Default Response */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/invites/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Revoke an unused invite */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Default Response */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/imports': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** The latest dataset import runs, newest first */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              runs: {
                id: number;
                importer: string;
                /** @enum {string} */
                status: 'running' | 'succeeded' | 'failed';
                /** Format: date-time */
                startedAt: string;
                /** Format: date-time */
                finishedAt: string | null;
                summary: {
                  [key: string]: unknown;
                };
              }[];
            };
          };
        };
        /** @description Default Response */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    put?: never;
    /** Start (or re-run) a dataset import in the worker */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': {
            /** @enum {string} */
            importer: 'kanjidic2' | 'jmdict' | 'kanjivg' | 'tatoeba' | 'level-lists';
            courseKey: string;
            file?: string;
          };
        };
      };
      responses: {
        /** @description Default Response */
        202: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              jobId: string;
            };
          };
        };
        /** @description Default Response */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        401: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        403: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
        /** @description Default Response */
        503: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              error: {
                /** @enum {string} */
                code:
                  | 'bad_request'
                  | 'validation_failed'
                  | 'unauthenticated'
                  | 'password_change_required'
                  | 'forbidden'
                  | 'not_found'
                  | 'conflict'
                  | 'idempotency_conflict'
                  | 'payload_too_large'
                  | 'rate_limited'
                  | 'internal_error'
                  | 'service_unavailable';
                message: string;
                details?: unknown;
              };
            };
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/openapi.json': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** OpenAPI description of this API */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Default Response */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: never;
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
