import { ContainerModule } from '@theia/core/shared/inversify';
import { OBSExplorerWidget } from './OBSExplorer-widget';
import { OBSExplorerContribution } from './OBSExplorer-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';
import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, OBSExplorerContribution);
    bind(FrontendApplicationContribution).toService(OBSExplorerContribution);
    bind(OBSExplorerWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: OBSExplorerWidget.ID,
        createWidget: () => ctx.container.get<OBSExplorerWidget>(OBSExplorerWidget)
    })).inSingletonScope();
});
