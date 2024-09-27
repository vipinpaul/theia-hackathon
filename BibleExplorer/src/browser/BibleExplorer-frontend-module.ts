import { ContainerModule } from '@theia/core/shared/inversify';
import { BibleExplorerWidget } from './BibleExplorer-widget';
import { BibleExplorerContribution } from './BibleExplorer-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, BibleExplorerContribution);
    bind(FrontendApplicationContribution).toService(BibleExplorerContribution);
    bind(BibleExplorerWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: BibleExplorerWidget.ID,
        createWidget: () => ctx.container.get<BibleExplorerWidget>(BibleExplorerWidget)
    })).inSingletonScope();
});
