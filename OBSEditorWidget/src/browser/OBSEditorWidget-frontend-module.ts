import { ContainerModule } from '@theia/core/shared/inversify';
import { OBSEditorWidgetWidget } from './OBSEditorWidget-widget';
import { OBSEditorWidgetContribution } from './OBSEditorWidget-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, OBSEditorWidgetContribution);
    bind(FrontendApplicationContribution).toService(OBSEditorWidgetContribution);
    bind(OBSEditorWidgetWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: OBSEditorWidgetWidget.ID,
        createWidget: () => ctx.container.get<OBSEditorWidgetWidget>(OBSEditorWidgetWidget)
    })).inSingletonScope();
});
