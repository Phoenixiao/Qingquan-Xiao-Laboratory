
/**
 * QINGQUAN XIAO LAB
 * Website Analytics API
 *
 * Cloudflare Workers
 * Database: Existing CloudBase PostgreSQL
 *
 * Uses the same database and RPC function as Tencent SCF.
 */

const SITE_ID = 'qingquan-xiao-lab';

const ALLOWED_ORIGINS = [
    'https://phoenixiao.github.io'
];


// ==========================================
// 1. Response Headers
// ==========================================

function getResponseHeaders(origin = '') {

    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Vary': 'Origin'
    };

    if (origin && ALLOWED_ORIGINS.includes(origin)) {

        headers['Access-Control-Allow-Origin'] = origin;

        headers['Access-Control-Allow-Methods'] =
            'GET, POST, OPTIONS';

        headers['Access-Control-Allow-Headers'] =
            'Content-Type';

        headers['Access-Control-Max-Age'] = '86400';
    }

    return headers;
}


// ==========================================
// 2. Standard JSON Response
// ==========================================

function makeResponse(statusCode, data, origin = '') {

    return new Response(
        JSON.stringify(data),
        {
            status: statusCode,
            headers: getResponseHeaders(origin)
        }
    );
}


// ==========================================
// 3. Database Request
// ==========================================

async function databaseRequest(endpoint, env, options = {}) {

    const ENV_ID = env.CLOUDBASE_ENV_ID;
    const API_KEY = env.CLOUDBASE_API_KEY;

    if (!ENV_ID || !API_KEY) {
        throw new Error(
            'CloudBase environment variables are missing'
        );
    }

    const DB_URL =
        `https://${ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest`;

    const response = await fetch(
        `${DB_URL}${endpoint}`,
        {
            ...options,

            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(options.headers || {})
            },

            signal: AbortSignal.timeout(10000)
        }
    );

    const responseText = await response.text();

    if (!response.ok) {

        console.error(
            'CloudBase database error:',
            response.status,
            responseText
        );

        throw new Error(
            `Database request failed: HTTP ${response.status}`
        );
    }

    try {
        return JSON.parse(responseText);
    } catch {
        throw new Error('Invalid database response');
    }
}


// ==========================================
// 4. Get Total Visits
// ==========================================

async function getTotalVisits(env) {

    const endpoint =
        `/site_analytics?select=total_visits&site_id=eq.${encodeURIComponent(SITE_ID)}`;

    const result = await databaseRequest(
        endpoint,
        env,
        {
            method: 'GET'
        }
    );

    if (!Array.isArray(result) || result.length === 0) {
        throw new Error('Analytics record not found');
    }

    return result[0].total_visits;
}


// ==========================================
// 5. Record One Visit
// ==========================================

async function recordVisit(env) {

    const result = await databaseRequest(
        '/rpc/record_site_visit',
        env,
        {
            method: 'POST',

            body: JSON.stringify({
                p_site_id: SITE_ID
            })
        }
    );

    if (
        typeof result !== 'number' &&
        typeof result !== 'string'
    ) {
        throw new Error('Invalid visit counter response');
    }

    return result;
}


// ==========================================
// 6. Main Cloudflare Worker
// ==========================================

export default {

    async fetch(request, env) {

        const origin =
            request.headers.get('Origin') || '';

        // --------------------------------------
        // CORS Origin Validation
        // --------------------------------------

        if (
            origin &&
            !ALLOWED_ORIGINS.includes(origin)
        ) {
            return makeResponse(
                403,
                {
                    success: false,
                    error: 'Origin not allowed'
                }
            );
        }

        // --------------------------------------
        // Request Method and Path
        // --------------------------------------

        const method = request.method.toUpperCase();

        const url = new URL(request.url);

        const path =
            url.pathname.replace(/\/+$/, '') || '/';


        // --------------------------------------
        // CORS Preflight
        // --------------------------------------

        if (method === 'OPTIONS') {

            return new Response(
                null,
                {
                    status: 204,
                    headers: getResponseHeaders(origin)
                }
            );
        }


        try {

            // ----------------------------------
            // API 1: Health Check
            // GET /health
            // ----------------------------------

            if (
                method === 'GET' &&
                path === '/health'
            ) {

                const totalVisits =
                    await getTotalVisits(env);

                return makeResponse(
                    200,
                    {
                        success: true,
                        service: 'Qingquan Xiao Lab Analytics - Cloudflare',
                        status: 'online',
                        database: 'connected',
                        total_visits: totalVisits
                    },
                    origin
                );
            }


            // ----------------------------------
            // API 2: Get Total Visits
            // GET /api/count
            // ----------------------------------

            if (
                method === 'GET' &&
                path === '/api/count'
            ) {

                const totalVisits =
                    await getTotalVisits(env);

                return makeResponse(
                    200,
                    {
                        success: true,
                        site_id: SITE_ID,
                        total_visits: totalVisits
                    },
                    origin
                );
            }


            // ----------------------------------
            // API 3: Record One Visit
            // POST /api/visit
            // ----------------------------------

            if (
                method === 'POST' &&
                path === '/api/visit'
            ) {

                const totalVisits =
                    await recordVisit(env);

                return makeResponse(
                    200,
                    {
                        success: true,
                        message: 'Visit recorded successfully',
                        site_id: SITE_ID,
                        total_visits: totalVisits
                    },
                    origin
                );
            }


            // ----------------------------------
            // Unknown API
            // ----------------------------------

            return makeResponse(
                404,
                {
                    success: false,
                    error: 'API endpoint not found'
                },
                origin
            );

        } catch (error) {

            console.error(
                'Analytics API error:',
                error.message
            );

            return makeResponse(
                500,
                {
                    success: false,
                    error: 'Internal server error'
                },
                origin
            );
        }
    }
};
