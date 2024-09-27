import { ContainerModule } from '@theia/core/shared/inversify';
import { ObsExtensionWidget } from './obs-extension-widget';
// import { WidgetContribution } from './widget-contribution';
import { ObsExtensionContribution} from './obs-extension-contribution'
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, ObsExtensionContribution);
    bind(FrontendApplicationContribution).toService(ObsExtensionContribution);
    bind(ObsExtensionWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: ObsExtensionWidget.ID,
        createWidget: () => ctx.container.get<ObsExtensionWidget>(ObsExtensionWidget)
    })).inSingletonScope();
});
