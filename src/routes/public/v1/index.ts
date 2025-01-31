import descriptionPublicRouter from './description.public.router';
import authPublicRouter from './auth.public.router';
import consentPublicRouter from './consent.public.router';
import dataPublicRouter from './data.public.router';
import providerPublicRouter from './provider.public.router';
import dataExchangePublicRouter from './dataExchange.public.router';
import consumerPublicRouter from './consumer.public.router';
import userPublicRouter from './user.public.router';
import nodePublicRouter from './node.public.router';
import negotiationsRouterDsp from '../../dsp/negotiations.router.dsp';
import transfersRouterDsp from '../../dsp/transfers.router.dsp';
import catalogRouterDsp from '../../dsp/catalog.router.dsp';
import versionRouterDsp from '../../dsp/version.router.dsp';

const routers = [
    {
        prefix: '/',
        router: descriptionPublicRouter,
    },
    {
        prefix: '/',
        router: authPublicRouter,
    },
    {
        prefix: '/consent',
        router: consentPublicRouter,
    },
    {
        prefix: '/data',
        router: dataPublicRouter,
    },
    {
        prefix: '/provider',
        router: providerPublicRouter,
    },
    {
        prefix: '/consumer',
        router: consumerPublicRouter,
    },
    {
        prefix: '/dataexchanges',
        router: dataExchangePublicRouter,
    },
    {
        prefix: '/users',
        router: userPublicRouter,
    },
    {
        prefix: '/node',
        router: nodePublicRouter,
    },
    {
        prefix: '/',
        router: negotiationsRouterDsp,
    },
    {
        prefix: '/',
        router: transfersRouterDsp,
    },
    {
        prefix: '/',
        router: catalogRouterDsp,
    },
    {
        prefix: '/',
        router: versionRouterDsp,
    },
];

export default {
    prefix: '',
    routers,
};
