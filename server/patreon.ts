import express = require("express");
import request = require("request");
import patreon = require('patreon');

const OAuthClient = patreon.oauth(process.env.PATREON_CLIENT_ID, process.env.PATREON_CLIENT_SECRET);

interface PatreonPostAttributes {
    title: string;
    content: string;
    url: string;
    created_at: string;
    was_posted_by_campaign_owner: boolean;
}

interface PatreonPost {
    attributes: PatreonPostAttributes;
    id: string;
    type: string;
}

export const configureLogin = (app: express.Express) => {
    const redirectPath = "/r/patreon";
    const redirectUri = process.env.BASE_URL + redirectPath;

    app.get(redirectPath, (req, res) => {
        const code = req.body.code,
            state = req.body.state;

        OAuthClient.getTokens(code, redirectUri, (tokensError, tokens) => {
            const APIClient = patreon.default(tokens.access_token);
            APIClient(`/current_user`, function (currentUserError, apiResponse) {
                if (currentUserError) {
                    console.error(currentUserError)
                    res.end(currentUserError)
                }

                res.end(apiResponse);
            });
        });
    });
}

export const getNews = (app: express.Express) => {
    if (!process.env.PATREON_URL) {
        return;
    }

    request.get(process.env.PATREON_URL,
        (error, response, body) => {
            const json: { data: PatreonPost[] } = JSON.parse(body);
            if (json.data) {
                const latestPost = json.data.filter(d => d.attributes.was_posted_by_campaign_owner)[0];
                app.get("/whatsnew/", (req, res) => {
                    res.json(latestPost);
                });
            }
        });
}

