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
                  /** @default null */
                  activeCourseId: number | null;
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
                  /** @default null */
                  activeCourseId: number | null;
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
                  /** @default null */
                  activeCourseId: number | null;
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
                /** @default null */
                activeCourseId: number | null;
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
    /** Change your display name or settings */
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': {
            displayName?: string;
            settings?: {
              avatarColor?: string | null;
              avatarInitial?: string | null;
              dailyGoal?: 10 | 20 | 30 | 50;
              newItemCap?: number;
              reviewCap?: number;
              drawingExercises?: boolean;
              preferWordBank?: boolean;
              /** @enum {string} */
              theme?: 'sakura' | 'matcha' | 'umi' | 'yuyake' | 'sumi';
              /** @enum {string} */
              colorMode?: 'system' | 'light' | 'dark';
              /** @enum {string} */
              readingAnnotations?: 'always' | 'unlearned' | 'never';
              /** @enum {string} */
              targetTextSize?: 'normal' | 'large';
              soundEffects?: boolean;
              audioAutoplay?: boolean;
              reducedMotion?: boolean;
              appearOnLeaderboard?: boolean;
              allowNudges?: boolean;
            };
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
                /** @default null */
                activeCourseId: number | null;
              };
              /** Format: date-time */
              disabledAt: string | null;
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
      };
    };
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
  '/api/v1/courses': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Published courses (and drafts for admins), with the caller's enrollments and active course */
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
              courses: {
                id: number;
                key: string;
                targetLang: string;
                baseLang: string;
                plugin: string;
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
                enrolled: boolean;
                active: boolean;
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
  '/api/v1/courses/{id}/enroll': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Enroll in a published course (once) and make it the active course */
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
          'application/json': Record<string, never> | null;
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
              key: string;
              targetLang: string;
              baseLang: string;
              plugin: string;
              title: string;
              /** @enum {string} */
              status: 'draft' | 'published';
              enrolled: boolean;
              active: boolean;
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
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/courses/{id}/path': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Sections, units and lessons in order with the caller's lesson states
     * @description Learners see published units and lessons; `preview=true` (admins only) adds drafts.
     */
    get: {
      parameters: {
        query?: {
          preview?: 'true' | 'false';
        };
        header?: never;
        path: {
          id: string;
        };
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
              course: {
                id: number;
                key: string;
                targetLang: string;
                baseLang: string;
                plugin: string;
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
              };
              sections: {
                id: number;
                key: string;
                title: string;
                levelCode: string;
                units: {
                  id: number;
                  key: string;
                  title: string;
                  /** @enum {string} */
                  status: 'draft' | 'published';
                  testOutAvailable: boolean;
                  lessons: {
                    id: number;
                    key: string;
                    /** @enum {string} */
                    type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                    title: string;
                    /** @enum {string} */
                    status: 'draft' | 'published';
                    /** @enum {string} */
                    state: 'locked' | 'available' | 'completed';
                  }[];
                }[];
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
  '/api/v1/lessons/{id}/sessions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Start a lesson session, or resume the unexpired one
     * @description Teaching cards for the new items, then 10 to 15 exercises with payloads and accept lists. A session is kept for 24 hours; starting again within that time returns it.
     */
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
          'application/json': Record<string, never> | null;
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
              teachingCards: {
                item: {
                  id: number;
                  courseId: number;
                  key: string;
                  type: string;
                  levelCode: string | null;
                  data: {
                    [key: string]: unknown;
                  };
                  overrides: {
                    [key: string]: unknown;
                  };
                  source: string | null;
                  datasetVersion: string | null;
                  /** Format: date-time */
                  archivedAt: string | null;
                };
                /** @default [] */
                examples: {
                  /** @default null */
                  sentenceId: number | null;
                  text: string;
                  translation: string;
                  tiles: {
                    surface: string;
                    base: string;
                    reading: string;
                    itemId?: number | null;
                    /** @enum {boolean} */
                    pattern?: true;
                  }[];
                }[];
                /** @default [] */
                words: {
                  id: number;
                  courseId: number;
                  key: string;
                  type: string;
                  levelCode: string | null;
                  data: {
                    [key: string]: unknown;
                  };
                  overrides: {
                    [key: string]: unknown;
                  };
                  source: string | null;
                  datasetVersion: string | null;
                  /** Format: date-time */
                  archivedAt: string | null;
                }[];
                /** @default false */
                strokeAnimation: boolean;
                /**
                 * @default null
                 * @enum {string|null}
                 */
                facet: 'meaning' | 'reading' | null;
                /** @default 0 */
                before: number;
              }[];
              exercises: {
                type: string;
                payload: {
                  [key: string]: unknown;
                };
              }[];
              id: number;
              lessonId: number;
              /** Format: date-time */
              expiresAt: string;
              lessonTitle: string;
              /** @enum {string} */
              lessonType: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
              sectionLevel: string;
              plugin: string;
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
  '/api/v1/lesson-sessions/{id}/complete': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Complete a lesson session
     * @description Re-grades the responses on the server, then records lesson progress and awards XP in one transaction. A retry with the same Idempotency-Key returns the first response.
     */
    post: {
      parameters: {
        query?: never;
        header?: {
          'idempotency-key'?: string;
        };
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': {
            responses: {
              attempts: unknown[];
            }[];
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
              lessonId: number;
              accuracy: number;
              xpEarned: number;
              totalXp: number;
              level: number;
              path: {
                course: {
                  id: number;
                  key: string;
                  targetLang: string;
                  baseLang: string;
                  plugin: string;
                  title: string;
                  /** @enum {string} */
                  status: 'draft' | 'published';
                };
                sections: {
                  id: number;
                  key: string;
                  title: string;
                  levelCode: string;
                  units: {
                    id: number;
                    key: string;
                    title: string;
                    /** @enum {string} */
                    status: 'draft' | 'published';
                    testOutAvailable: boolean;
                    lessons: {
                      id: number;
                      key: string;
                      /** @enum {string} */
                      type:
                        'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                      title: string;
                      /** @enum {string} */
                      status: 'draft' | 'published';
                      /** @enum {string} */
                      state: 'locked' | 'available' | 'completed';
                    }[];
                  }[];
                }[];
              };
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
  '/api/v1/units/{id}/test-out': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Start a unit test-out, or resume the unexpired one
     * @description 20 exercises drawn from the unit's items. Offered for an open unit that is not finished. A session is kept for 24 hours; starting again within that time returns it.
     */
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
          'application/json': Record<string, never> | null;
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
              exercises: {
                type: string;
                payload: {
                  [key: string]: unknown;
                };
              }[];
              id: number;
              unitId: number;
              unitTitle: string;
              /** Format: date-time */
              expiresAt: string;
              sectionLevel: string;
              plugin: string;
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
  '/api/v1/test-out-sessions/{id}/complete': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Complete a unit test-out
     * @description Re-grades the responses on the server. At 85% or better the unit is finished and earns test-out XP, in one transaction. A retry with the same Idempotency-Key returns the first response.
     */
    post: {
      parameters: {
        query?: never;
        header?: {
          'idempotency-key'?: string;
        };
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': {
            responses: {
              attempts: unknown[];
            }[];
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
              accuracy: number;
              xpEarned: number;
              totalXp: number;
              level: number;
              path: {
                course: {
                  id: number;
                  key: string;
                  targetLang: string;
                  baseLang: string;
                  plugin: string;
                  title: string;
                  /** @enum {string} */
                  status: 'draft' | 'published';
                };
                sections: {
                  id: number;
                  key: string;
                  title: string;
                  levelCode: string;
                  units: {
                    id: number;
                    key: string;
                    title: string;
                    /** @enum {string} */
                    status: 'draft' | 'published';
                    testOutAvailable: boolean;
                    lessons: {
                      id: number;
                      key: string;
                      /** @enum {string} */
                      type:
                        'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                      title: string;
                      /** @enum {string} */
                      status: 'draft' | 'published';
                      /** @enum {string} */
                      state: 'locked' | 'available' | 'completed';
                    }[];
                  }[];
                }[];
              };
              unitId: number;
              passed: boolean;
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
  '/api/v1/me/stats': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** The caller's daily goal, today's XP and streak */
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
              dailyGoal: 10 | 20 | 30 | 50;
              todayXp: number;
              currentStreak: number;
              longestStreak: number;
              freezes: number;
              pendingFreezeSpend: {
                days: number;
              } | null;
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
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/me/streak/freezes': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Spend the streak freezes on offer to keep the streak, or let it reset */
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
            spend: boolean;
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
              dailyGoal: 10 | 20 | 30 | 50;
              todayXp: number;
              currentStreak: number;
              longestStreak: number;
              freezes: number;
              pendingFreezeSpend: {
                days: number;
              } | null;
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
  '/api/v1/reviews/summary': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Items due now and a 7-day forecast */
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
              dueNow: number;
              forecast: {
                /** Format: date */
                date: string;
                count: number;
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
  '/api/v1/reviews/sessions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Start a review session, or resume the unexpired one
     * @description Up to 20 due items, oldest due first, with one exercise per due facet. A session is kept for 24 hours; starting again within that time returns it. 409 when nothing is due.
     */
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
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              id: number;
              /** Format: date-time */
              expiresAt: string;
              exercises: {
                type: string;
                payload: {
                  [key: string]: unknown;
                };
                itemId: number;
                facet: string;
                plugin: string;
                correct: boolean | null;
                retry: boolean;
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
  '/api/v1/review-sessions/{id}/answers': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Answer one review exercise
     * @description Re-grades the response (both attempts) on the server and saves it in one transaction. A wrong answer queues the exercise again at the end until it is right; only the first answer counts. Once all of an item's facets in the session are answered, the item moves up a stage if all were right, or down if any was wrong.
     */
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
            index: number;
            response: {
              attempts: unknown[];
            };
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
              correct: boolean;
              stage: number | null;
              xpEarned: number;
              retryIndex: number | null;
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
  '/api/v1/items': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * A course's items, filtered and searched, with the learner's stages
     * @description Filters by type, level, stroke count, radical and stage band; `q` searches character, meaning, reading and pattern. Ordered oldest first; cursor paginated.
     */
    get: {
      parameters: {
        query: {
          cursor?: string;
          limit?: number;
          courseId: number;
          type?: string;
          level?: string;
          strokeCount?: number;
          radical?: string;
          stage?: 'not_started' | 'learning' | 'familiar' | 'strong' | 'mastered' | 'retired';
          q?: string;
        };
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
              items: {
                id: number;
                key: string;
                type: string;
                levelCode: string | null;
                data: {
                  [key: string]: unknown;
                };
                stage: number | null;
              }[];
              nextCursor: string | null;
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
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/items/{key}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** One item with the learner’s facets, linked items and example sentences */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          key: string;
        };
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
              key: string;
              type: string;
              levelCode: string | null;
              data: {
                [key: string]: unknown;
              };
              stage: number | null;
              facets: {
                facet: string;
                stage: number;
                /** Format: date-time */
                dueAt: string | null;
              }[];
              links: {
                /** @enum {string} */
                kind: 'contains' | 'related' | 'component';
                /** @enum {string} */
                direction: 'outgoing' | 'incoming';
                item: {
                  id: number;
                  key: string;
                  type: string;
                  levelCode: string | null;
                  data: {
                    [key: string]: unknown;
                  };
                  stage: number | null;
                };
              }[];
              sentences: {
                id: number;
                text: string;
                translation: string;
                tokens: {
                  surface: string;
                  base: string;
                  reading: string;
                  itemId?: number | null;
                  /** @enum {boolean} */
                  pattern?: true;
                }[];
                attribution: {
                  sentence: {
                    sourceId: string;
                    owner: string | null;
                    /** Format: uri */
                    url: string;
                    licence: string;
                    datasetVersion: string;
                  };
                  translation: {
                    sourceId: string;
                    owner: string | null;
                    /** Format: uri */
                    url: string;
                    licence: string;
                    datasetVersion: string;
                  };
                  otherTranslationIds?: string[];
                } | null;
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
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/follows/{userId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /** Follow a learner (one-way, no approval; repeating it changes nothing) */
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          userId: string;
        };
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
    post?: never;
    /** Unfollow a learner (unfollowing someone not followed changes nothing) */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          userId: string;
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
  '/api/v1/friends': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Learners the caller follows, with streak, level, weekly XP and section */
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
              friends: {
                id: number;
                displayName: string;
                currentStreak: number;
                level: number | null;
                weeklyXp: number;
                section: string | null;
                following: boolean;
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
  '/api/v1/users/{userId}/profile': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** A learner's public profile (no email, username or settings) */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          userId: string;
        };
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
              displayName: string;
              currentStreak: number;
              level: number | null;
              weeklyXp: number;
              section: string | null;
              following: boolean;
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
  '/api/v1/nudges': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** The caller's newest nudges, read on app load */
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
              nudges: {
                id: number;
                fromUserId: number;
                fromDisplayName: string;
                /** @enum {string} */
                kind: 'nice_work' | 'keep_going';
                /** Format: date-time */
                sentAt: string;
                seen: boolean;
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
    /** Nudge a friend: once per friend per day, not to learners who opted out */
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
            toUserId: number;
            /** @enum {string} */
            kind: 'nice_work' | 'keep_going';
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
  '/api/v1/nudges/seen': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Mark all of the caller’s nudges as seen */
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
  '/api/v1/leaderboard': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** This week's XP ranking of opted-in learners, across all courses */
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
              weekStart: string;
              entries: {
                rank: number;
                userId: number;
                displayName: string;
                xp: number;
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
  '/api/v1/me/badges': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** The caller's top-three finishes in past weeks */
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
              badges: {
                weekStart: string;
                rank: number;
                xp: number;
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
                  /** @default null */
                  activeCourseId: number | null;
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
                /** @default null */
                activeCourseId: number | null;
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
  '/api/v1/authoring/courses/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** A course's sections, units and lessons in order, drafts included */
    get: {
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
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              course: {
                id: number;
                key: string;
                targetLang: string;
                baseLang: string;
                plugin: string;
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
              };
              sections: {
                id: number;
                courseId: number;
                key: string;
                position: number;
                title: string;
                levelCode: string;
                units: {
                  id: number;
                  sectionId: number;
                  key: string;
                  position: number;
                  title: string;
                  /** @enum {string} */
                  status: 'draft' | 'published';
                  lessons: {
                    id: number;
                    unitId: number;
                    key: string;
                    position: number;
                    /** @enum {string} */
                    type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                    title: string;
                    /** @enum {string} */
                    status: 'draft' | 'published';
                  }[];
                }[];
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
  '/api/v1/authoring/courses/{id}/sections': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Add a section at the end of the course; its key is the course's key plus slug */
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
            slug: string;
            title: string;
            levelCode: string;
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
              course: {
                id: number;
                key: string;
                targetLang: string;
                baseLang: string;
                plugin: string;
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
              };
              sections: {
                id: number;
                courseId: number;
                key: string;
                position: number;
                title: string;
                levelCode: string;
                units: {
                  id: number;
                  sectionId: number;
                  key: string;
                  position: number;
                  title: string;
                  /** @enum {string} */
                  status: 'draft' | 'published';
                  lessons: {
                    id: number;
                    unitId: number;
                    key: string;
                    position: number;
                    /** @enum {string} */
                    type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                    title: string;
                    /** @enum {string} */
                    status: 'draft' | 'published';
                  }[];
                }[];
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
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/authoring/sections/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Delete a section with its units and lessons; archived instead if it has progress */
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
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              course: {
                id: number;
                key: string;
                targetLang: string;
                baseLang: string;
                plugin: string;
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
              };
              sections: {
                id: number;
                courseId: number;
                key: string;
                position: number;
                title: string;
                levelCode: string;
                units: {
                  id: number;
                  sectionId: number;
                  key: string;
                  position: number;
                  title: string;
                  /** @enum {string} */
                  status: 'draft' | 'published';
                  lessons: {
                    id: number;
                    unitId: number;
                    key: string;
                    position: number;
                    /** @enum {string} */
                    type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                    title: string;
                    /** @enum {string} */
                    status: 'draft' | 'published';
                  }[];
                }[];
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
    options?: never;
    head?: never;
    /** Rename a section, change its level or move it to another position */
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
            title?: string;
            levelCode?: string;
            position?: number;
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
              course: {
                id: number;
                key: string;
                targetLang: string;
                baseLang: string;
                plugin: string;
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
              };
              sections: {
                id: number;
                courseId: number;
                key: string;
                position: number;
                title: string;
                levelCode: string;
                units: {
                  id: number;
                  sectionId: number;
                  key: string;
                  position: number;
                  title: string;
                  /** @enum {string} */
                  status: 'draft' | 'published';
                  lessons: {
                    id: number;
                    unitId: number;
                    key: string;
                    position: number;
                    /** @enum {string} */
                    type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                    title: string;
                    /** @enum {string} */
                    status: 'draft' | 'published';
                  }[];
                }[];
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
    trace?: never;
  };
  '/api/v1/authoring/units': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Add a draft unit at the end of a section */
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
            sectionId: number;
            slug: string;
            title: string;
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
              course: {
                id: number;
                key: string;
                targetLang: string;
                baseLang: string;
                plugin: string;
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
              };
              sections: {
                id: number;
                courseId: number;
                key: string;
                position: number;
                title: string;
                levelCode: string;
                units: {
                  id: number;
                  sectionId: number;
                  key: string;
                  position: number;
                  title: string;
                  /** @enum {string} */
                  status: 'draft' | 'published';
                  lessons: {
                    id: number;
                    unitId: number;
                    key: string;
                    position: number;
                    /** @enum {string} */
                    type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                    title: string;
                    /** @enum {string} */
                    status: 'draft' | 'published';
                  }[];
                }[];
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
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/authoring/units/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Delete a unit with its lessons; archived instead if it has progress */
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
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              course: {
                id: number;
                key: string;
                targetLang: string;
                baseLang: string;
                plugin: string;
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
              };
              sections: {
                id: number;
                courseId: number;
                key: string;
                position: number;
                title: string;
                levelCode: string;
                units: {
                  id: number;
                  sectionId: number;
                  key: string;
                  position: number;
                  title: string;
                  /** @enum {string} */
                  status: 'draft' | 'published';
                  lessons: {
                    id: number;
                    unitId: number;
                    key: string;
                    position: number;
                    /** @enum {string} */
                    type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                    title: string;
                    /** @enum {string} */
                    status: 'draft' | 'published';
                  }[];
                }[];
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
    options?: never;
    head?: never;
    /** Rename, publish or unpublish a unit, or move it to another position */
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
            title?: string;
            /** @enum {string} */
            status?: 'draft' | 'published';
            position?: number;
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
              course: {
                id: number;
                key: string;
                targetLang: string;
                baseLang: string;
                plugin: string;
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
              };
              sections: {
                id: number;
                courseId: number;
                key: string;
                position: number;
                title: string;
                levelCode: string;
                units: {
                  id: number;
                  sectionId: number;
                  key: string;
                  position: number;
                  title: string;
                  /** @enum {string} */
                  status: 'draft' | 'published';
                  lessons: {
                    id: number;
                    unitId: number;
                    key: string;
                    position: number;
                    /** @enum {string} */
                    type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                    title: string;
                    /** @enum {string} */
                    status: 'draft' | 'published';
                  }[];
                }[];
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
    trace?: never;
  };
  '/api/v1/authoring/lessons': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Add a draft lesson at the end of a unit */
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
            unitId: number;
            slug: string;
            /** @enum {string} */
            type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
            title: string;
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
              course: {
                id: number;
                key: string;
                targetLang: string;
                baseLang: string;
                plugin: string;
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
              };
              sections: {
                id: number;
                courseId: number;
                key: string;
                position: number;
                title: string;
                levelCode: string;
                units: {
                  id: number;
                  sectionId: number;
                  key: string;
                  position: number;
                  title: string;
                  /** @enum {string} */
                  status: 'draft' | 'published';
                  lessons: {
                    id: number;
                    unitId: number;
                    key: string;
                    position: number;
                    /** @enum {string} */
                    type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                    title: string;
                    /** @enum {string} */
                    status: 'draft' | 'published';
                  }[];
                }[];
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
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/authoring/lessons/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Delete a lesson; archived instead if it has progress */
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
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              course: {
                id: number;
                key: string;
                targetLang: string;
                baseLang: string;
                plugin: string;
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
              };
              sections: {
                id: number;
                courseId: number;
                key: string;
                position: number;
                title: string;
                levelCode: string;
                units: {
                  id: number;
                  sectionId: number;
                  key: string;
                  position: number;
                  title: string;
                  /** @enum {string} */
                  status: 'draft' | 'published';
                  lessons: {
                    id: number;
                    unitId: number;
                    key: string;
                    position: number;
                    /** @enum {string} */
                    type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                    title: string;
                    /** @enum {string} */
                    status: 'draft' | 'published';
                  }[];
                }[];
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
    options?: never;
    head?: never;
    /** Rename, retype, publish or unpublish a lesson, or move it to another position */
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
            title?: string;
            /** @enum {string} */
            type?: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
            /** @enum {string} */
            status?: 'draft' | 'published';
            position?: number;
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
              course: {
                id: number;
                key: string;
                targetLang: string;
                baseLang: string;
                plugin: string;
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
              };
              sections: {
                id: number;
                courseId: number;
                key: string;
                position: number;
                title: string;
                levelCode: string;
                units: {
                  id: number;
                  sectionId: number;
                  key: string;
                  position: number;
                  title: string;
                  /** @enum {string} */
                  status: 'draft' | 'published';
                  lessons: {
                    id: number;
                    unitId: number;
                    key: string;
                    position: number;
                    /** @enum {string} */
                    type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                    title: string;
                    /** @enum {string} */
                    status: 'draft' | 'published';
                  }[];
                }[];
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
    trace?: never;
  };
  '/api/v1/authoring/word-lists/supplementary-words': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Supplementary words, optionally of one course or level */
    get: {
      parameters: {
        query?: {
          course?: string;
          level?: string;
        };
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
              words: {
                id: number;
                course: string;
                level: string;
                written: string;
                reading: string;
                note: string | null;
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
    /** Add a supplementary word to a course level */
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
            course: string;
            level: string;
            written: string;
            reading: string;
            note?: string;
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
              id: number;
              course: string;
              level: string;
              written: string;
              reading: string;
              note: string | null;
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
  '/api/v1/authoring/word-lists/supplementary-words/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Remove a supplementary word */
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
    /** Edit a supplementary word */
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
            level?: string;
            written?: string;
            reading?: string;
            note?: string | null;
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
              course: string;
              level: string;
              written: string;
              reading: string;
              note: string | null;
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
  '/api/v1/authoring/word-lists/blocked-words': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Blocked words, optionally of one language */
    get: {
      parameters: {
        query?: {
          lang?: string;
        };
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
              words: {
                id: number;
                lang: string;
                word: string;
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
    /** Block a word of a language */
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
            lang: string;
            word: string;
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
              id: number;
              lang: string;
              word: string;
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
  '/api/v1/authoring/word-lists/blocked-words/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Unblock a word */
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
  '/api/v1/authoring/lessons/{id}/editor': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** A lesson's new items and its authored and pinned exercises, in session order */
    get: {
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
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              lesson: {
                id: number;
                unitId: number;
                key: string;
                position: number;
                /** @enum {string} */
                type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
                courseId: number;
                plugin: string;
                sectionLevel: string;
              };
              items: {
                id: number;
                courseId: number;
                key: string;
                type: string;
                levelCode: string | null;
                data: {
                  [key: string]: unknown;
                };
                overrides: {
                  [key: string]: unknown;
                };
                source: string | null;
                datasetVersion: string | null;
                /** Format: date-time */
                archivedAt: string | null;
              }[];
              exercises: {
                id: number;
                type: string;
                payload: {
                  [key: string]: unknown;
                };
                /** @enum {string} */
                origin: 'authored' | 'pinned';
                key: string | null;
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
  '/api/v1/authoring/lessons/{id}/items': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /** Set the lesson's new items, in teaching order */
    put: {
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
            itemIds: number[];
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
              lesson: {
                id: number;
                unitId: number;
                key: string;
                position: number;
                /** @enum {string} */
                type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
                courseId: number;
                plugin: string;
                sectionLevel: string;
              };
              items: {
                id: number;
                courseId: number;
                key: string;
                type: string;
                levelCode: string | null;
                data: {
                  [key: string]: unknown;
                };
                overrides: {
                  [key: string]: unknown;
                };
                source: string | null;
                datasetVersion: string | null;
                /** Format: date-time */
                archivedAt: string | null;
              }[];
              exercises: {
                id: number;
                type: string;
                payload: {
                  [key: string]: unknown;
                };
                /** @enum {string} */
                origin: 'authored' | 'pinned';
                key: string | null;
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
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/authoring/lessons/{id}/generated': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Exercises the lesson type's generators make from its new items, to pin */
    get: {
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
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              exercises: {
                type: string;
                payload: {
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
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/authoring/lessons/{id}/preview': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Build the lesson as a learner would get it, without saving a session
     * @description Drafts included. Nothing is written, so a preview records no progress or XP.
     */
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
          'application/json': Record<string, never> | null;
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
              teachingCards: {
                item: {
                  id: number;
                  courseId: number;
                  key: string;
                  type: string;
                  levelCode: string | null;
                  data: {
                    [key: string]: unknown;
                  };
                  overrides: {
                    [key: string]: unknown;
                  };
                  source: string | null;
                  datasetVersion: string | null;
                  /** Format: date-time */
                  archivedAt: string | null;
                };
                /** @default [] */
                examples: {
                  /** @default null */
                  sentenceId: number | null;
                  text: string;
                  translation: string;
                  tiles: {
                    surface: string;
                    base: string;
                    reading: string;
                    itemId?: number | null;
                    /** @enum {boolean} */
                    pattern?: true;
                  }[];
                }[];
                /** @default [] */
                words: {
                  id: number;
                  courseId: number;
                  key: string;
                  type: string;
                  levelCode: string | null;
                  data: {
                    [key: string]: unknown;
                  };
                  overrides: {
                    [key: string]: unknown;
                  };
                  source: string | null;
                  datasetVersion: string | null;
                  /** Format: date-time */
                  archivedAt: string | null;
                }[];
                /** @default false */
                strokeAnimation: boolean;
                /**
                 * @default null
                 * @enum {string|null}
                 */
                facet: 'meaning' | 'reading' | null;
                /** @default 0 */
                before: number;
              }[];
              exercises: {
                type: string;
                payload: {
                  [key: string]: unknown;
                };
              }[];
              lessonId: number;
              lessonTitle: string;
              /** @enum {string} */
              lessonType: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
              sectionLevel: string;
              plugin: string;
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
  '/api/v1/authoring/exercises': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Add an authored or pinned exercise at the end of a lesson
     * @description The payload is validated by its exercise type. Answer text without tiles is segmented; blocklist words found come back as a warning.
     */
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
            lessonId: number;
            type: string;
            /** @enum {string} */
            origin: 'authored' | 'pinned';
            payload: {
              [key: string]: unknown;
            };
            original?: {
              [key: string]: unknown;
            };
            /** @default false */
            resegment?: boolean;
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
              exercise: {
                id: number;
                type: string;
                payload: {
                  [key: string]: unknown;
                };
                /** @enum {string} */
                origin: 'authored' | 'pinned';
                key: string | null;
              };
              blockedWords: string[];
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
  '/api/v1/authoring/exercises/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Remove an exercise; archived instead if an answer report refers to it */
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
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              lesson: {
                id: number;
                unitId: number;
                key: string;
                position: number;
                /** @enum {string} */
                type: 'kana' | 'vocabulary' | 'kanji' | 'grammar' | 'listening' | 'unit_review';
                title: string;
                /** @enum {string} */
                status: 'draft' | 'published';
                courseId: number;
                plugin: string;
                sectionLevel: string;
              };
              items: {
                id: number;
                courseId: number;
                key: string;
                type: string;
                levelCode: string | null;
                data: {
                  [key: string]: unknown;
                };
                overrides: {
                  [key: string]: unknown;
                };
                source: string | null;
                datasetVersion: string | null;
                /** Format: date-time */
                archivedAt: string | null;
              }[];
              exercises: {
                id: number;
                type: string;
                payload: {
                  [key: string]: unknown;
                };
                /** @enum {string} */
                origin: 'authored' | 'pinned';
                key: string | null;
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
    options?: never;
    head?: never;
    /**
     * Replace a lesson's or an item-level exercise's payload
     * @description Tiles sent are kept; answer text without tiles is segmented, and resegment re-segments every answer text. Blocklist words found come back as a warning.
     */
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
            payload: {
              [key: string]: unknown;
            };
            /** @default false */
            resegment?: boolean;
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
              exercise: {
                id: number;
                type: string;
                payload: {
                  [key: string]: unknown;
                };
                /** @enum {string} */
                origin: 'authored' | 'pinned';
                key: string | null;
              };
              blockedWords: string[];
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
  '/api/v1/authoring/items': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** A course's active items whose key contains `q`, first 50 by key */
    get: {
      parameters: {
        query: {
          course: string;
          type?: string;
          q?: string;
        };
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
              items: {
                id: number;
                key: string;
                type: string;
                levelCode: string | null;
                source: string | null;
                overridden: boolean;
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
    /** Create an authored item, such as a grammar point (FR-222) */
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
            course: number;
            type: string;
            key: string;
            level: string | null;
            data: {
              [key: string]: unknown;
            };
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
              id: number;
              key: string;
              type: string;
              levelCode: string | null;
              source: string | null;
              datasetVersion: string | null;
              data: {
                [key: string]: unknown;
              };
              overrides: {
                [key: string]: unknown;
              };
              effective: {
                [key: string]: unknown;
              };
              fields: {
                name: string;
                /** @enum {string} */
                kind: 'text' | 'longText' | 'number' | 'textList' | 'json';
                optional: boolean;
              }[];
              related: string[];
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
  '/api/v1/authoring/items/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** An item's imported data, author overrides, merged data and form fields */
    get: {
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
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              id: number;
              key: string;
              type: string;
              levelCode: string | null;
              source: string | null;
              datasetVersion: string | null;
              data: {
                [key: string]: unknown;
              };
              overrides: {
                [key: string]: unknown;
              };
              effective: {
                [key: string]: unknown;
              };
              fields: {
                name: string;
                /** @enum {string} */
                kind: 'text' | 'longText' | 'number' | 'textList' | 'json';
                optional: boolean;
              }[];
              related: string[];
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
    /** Replace an item's overrides (and an authored item's level and related items); the merged data must pass the language schema */
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
            overrides: {
              [key: string]: unknown;
            };
            level?: string | null;
            related?: string[];
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
              key: string;
              type: string;
              levelCode: string | null;
              source: string | null;
              datasetVersion: string | null;
              data: {
                [key: string]: unknown;
              };
              overrides: {
                [key: string]: unknown;
              };
              effective: {
                [key: string]: unknown;
              };
              fields: {
                name: string;
                /** @enum {string} */
                kind: 'text' | 'longText' | 'number' | 'textList' | 'json';
                optional: boolean;
              }[];
              related: string[];
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
  '/api/v1/authoring/items/{id}/exercises': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * An item's item-level exercises, such as review exercises pinned from reports
     * @description Oldest first. Edit one with PATCH /authoring/exercises/{id}.
     */
    get: {
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
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              exercises: {
                id: number;
                type: string;
                payload: {
                  [key: string]: unknown;
                };
                /** @enum {string} */
                origin: 'authored' | 'pinned';
                key: string | null;
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
  '/api/v1/authoring/items/{id}/exercises/{exerciseId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Remove an item-level exercise; archived instead if an answer report refers to it */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
          exerciseId: string;
        };
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
              exercises: {
                id: number;
                type: string;
                payload: {
                  [key: string]: unknown;
                };
                /** @enum {string} */
                origin: 'authored' | 'pinned';
                key: string | null;
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
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/authoring/sentences': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** A course's active sentences by review status, grammar point or text, first 50 */
    get: {
      parameters: {
        query: {
          course: string;
          status?: 'unreviewed' | 'flagged' | 'reviewed';
          grammar?: string;
          q?: string;
        };
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
              sentences: {
                id: number;
                text: string;
                translation: string;
                /** @enum {string} */
                reviewStatus: 'unreviewed' | 'flagged' | 'reviewed';
                grammarLevelCode: string | null;
                challenging: boolean;
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
      };
    };
    put?: never;
    /** Create an authored sentence, segmented and with its grammar detected */
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
            course: number;
            text: string;
            translation: string;
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
              sentence: {
                id: number;
                courseId: number;
                text: string;
                tokens: {
                  surface: string;
                  base: string;
                  reading: string;
                  itemId?: number | null;
                  /** @enum {boolean} */
                  pattern?: true;
                }[];
                translation: string;
                source: string | null;
                sourceId: string | null;
                attribution: {
                  sentence: {
                    sourceId: string;
                    owner: string | null;
                    /** Format: uri */
                    url: string;
                    licence: string;
                    datasetVersion: string;
                  };
                  translation: {
                    sourceId: string;
                    owner: string | null;
                    /** Format: uri */
                    url: string;
                    licence: string;
                    datasetVersion: string;
                  };
                  otherTranslationIds?: string[];
                } | null;
                /** @enum {string} */
                reviewStatus: 'unreviewed' | 'flagged' | 'reviewed';
                grammar: string[];
                vocabLevelCode: string | null;
                grammarLevelCode: string | null;
                challengeOverride: boolean | null;
                edited: boolean;
                translationEdited: boolean;
                tokensEdited: boolean;
                /** Format: date-time */
                archivedAt: string | null;
              };
              challenging: boolean;
              blockedWords: string[];
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
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/authoring/sentences/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** A sentence with its challenge status and blocklist warnings */
    get: {
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
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              sentence: {
                id: number;
                courseId: number;
                text: string;
                tokens: {
                  surface: string;
                  base: string;
                  reading: string;
                  itemId?: number | null;
                  /** @enum {boolean} */
                  pattern?: true;
                }[];
                translation: string;
                source: string | null;
                sourceId: string | null;
                attribution: {
                  sentence: {
                    sourceId: string;
                    owner: string | null;
                    /** Format: uri */
                    url: string;
                    licence: string;
                    datasetVersion: string;
                  };
                  translation: {
                    sourceId: string;
                    owner: string | null;
                    /** Format: uri */
                    url: string;
                    licence: string;
                    datasetVersion: string;
                  };
                  otherTranslationIds?: string[];
                } | null;
                /** @enum {string} */
                reviewStatus: 'unreviewed' | 'flagged' | 'reviewed';
                grammar: string[];
                vocabLevelCode: string | null;
                grammarLevelCode: string | null;
                challengeOverride: boolean | null;
                edited: boolean;
                translationEdited: boolean;
                tokensEdited: boolean;
                /** Format: date-time */
                archivedAt: string | null;
              };
              challenging: boolean;
              blockedWords: string[];
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
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** Edit a sentence's text, translation, tiles, review status or challenge status */
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
            text?: string;
            translation?: string;
            tiles?: {
              surface: string;
              base: string;
              reading: string;
              itemId?: number | null;
              /** @enum {boolean} */
              pattern?: true;
            }[];
            resegment?: boolean;
            /** @enum {string} */
            reviewStatus?: 'unreviewed' | 'flagged' | 'reviewed';
            challengeOverride?: boolean | null;
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
              sentence: {
                id: number;
                courseId: number;
                text: string;
                tokens: {
                  surface: string;
                  base: string;
                  reading: string;
                  itemId?: number | null;
                  /** @enum {boolean} */
                  pattern?: true;
                }[];
                translation: string;
                source: string | null;
                sourceId: string | null;
                attribution: {
                  sentence: {
                    sourceId: string;
                    owner: string | null;
                    /** Format: uri */
                    url: string;
                    licence: string;
                    datasetVersion: string;
                  };
                  translation: {
                    sourceId: string;
                    owner: string | null;
                    /** Format: uri */
                    url: string;
                    licence: string;
                    datasetVersion: string;
                  };
                  otherTranslationIds?: string[];
                } | null;
                /** @enum {string} */
                reviewStatus: 'unreviewed' | 'flagged' | 'reviewed';
                grammar: string[];
                vocabLevelCode: string | null;
                grammarLevelCode: string | null;
                challengeOverride: boolean | null;
                edited: boolean;
                translationEdited: boolean;
                tokensEdited: boolean;
                /** Format: date-time */
                archivedAt: string | null;
              };
              challenging: boolean;
              blockedWords: string[];
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
      };
    };
    trace?: never;
  };
  '/api/v1/media/audio/{ownerType}/{ownerId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Ogg Opus clip of an item or sentence, generated on first request */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          ownerType: 'item' | 'sentence';
          ownerId: string;
        };
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
            'application/json': unknown;
          };
        };
        /** @description Default Response */
        304: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': unknown;
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
  '/api/v1/media/strokes/{itemKey}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** A kanji's or kana's stroke data (an outline and a median per stroke) */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          itemKey: string;
        };
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
              strokes: string[];
              medians: number[][][];
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
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/authoring/audio/{ownerType}/{ownerId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Whether an item or sentence has an uploaded recording, and whether it is current */
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          ownerType: 'item' | 'sentence';
          ownerId: string;
        };
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
              uploaded: boolean;
              stale: boolean;
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
        413: {
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
    /** Upload a recording (audio/ogg, audio/opus, audio/mpeg, audio/mp3, audio/wav, audio/x-wav, audio/wave, audio/webm, audio/mp4, audio/x-m4a, audio/flac; at most 5 MB) that replaces the generated clip */
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          ownerType: 'item' | 'sentence';
          ownerId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': unknown;
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
              uploaded: boolean;
              stale: boolean;
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
        413: {
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
    post?: never;
    /** Remove an uploaded recording, so the generated clip plays again */
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          ownerType: 'item' | 'sentence';
          ownerId: string;
        };
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
              uploaded: boolean;
              stale: boolean;
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
        413: {
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
  '/api/v1/answer-reports': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Report an answer that should be accepted
     * @description Names the exercise by the session it was played in and its type and payload as served; the server reports its own copy. Only exercises with an accept list, and only answers graded wrong. Filing the same open report again returns it with 200.
     */
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
            session: {
              /** @enum {string} */
              kind: 'lesson' | 'review';
              id: number;
            };
            exercise: {
              type: string;
              payload: {
                [key: string]: unknown;
              };
            };
            answer: string;
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
              /** @enum {string} */
              status: 'open' | 'accepted' | 'dismissed';
              /** Format: date-time */
              createdAt: string;
            };
          };
        };
        /** @description Default Response */
        201: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': {
              id: number;
              /** @enum {string} */
              status: 'open' | 'accepted' | 'dismissed';
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
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/authoring/reports': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Answer reports of a status (open by default), oldest first */
    get: {
      parameters: {
        query?: {
          cursor?: string;
          limit?: number;
          status?: 'open' | 'accepted' | 'dismissed';
        };
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
              items: {
                id: number;
                /** @enum {string} */
                status: 'open' | 'accepted' | 'dismissed';
                exerciseType: string;
                exercisePayload: {
                  [key: string]: unknown;
                };
                givenAnswer: string;
                exerciseId: number | null;
                currentAccept: string[] | null;
                itemId: number | null;
                lessonId: number | null;
                courseId: number;
                courseTitle: string;
                plugin: string;
                reporter: string | null;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                resolvedAt: string | null;
              }[];
              nextCursor: string | null;
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
  '/api/v1/authoring/reports/{id}/accept': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Accept a report: add its answer to the exercise's accept list
     * @description A generated exercise is pinned first (into the lesson it was played in, or at item level for reviews and test-outs), so the accept list persists.
     */
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
          'application/json': Record<string, never> | null;
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
              /** @enum {string} */
              status: 'open' | 'accepted' | 'dismissed';
              exerciseType: string;
              exercisePayload: {
                [key: string]: unknown;
              };
              givenAnswer: string;
              exerciseId: number | null;
              currentAccept: string[] | null;
              itemId: number | null;
              lessonId: number | null;
              courseId: number;
              courseTitle: string;
              plugin: string;
              reporter: string | null;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              resolvedAt: string | null;
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
  '/api/v1/authoring/reports/{id}/dismiss': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Dismiss a report; the exercise is unchanged */
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
          'application/json': Record<string, never> | null;
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
              /** @enum {string} */
              status: 'open' | 'accepted' | 'dismissed';
              exerciseType: string;
              exercisePayload: {
                [key: string]: unknown;
              };
              givenAnswer: string;
              exerciseId: number | null;
              currentAccept: string[] | null;
              itemId: number | null;
              lessonId: number | null;
              courseId: number;
              courseTitle: string;
              plugin: string;
              reporter: string | null;
              /** Format: date-time */
              createdAt: string;
              /** Format: date-time */
              resolvedAt: string | null;
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
