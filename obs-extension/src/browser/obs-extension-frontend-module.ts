/**
 * Generated using theia-extension-generator
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import { ObsExtensionContribution } from './obs-extension-contribution';


export default new ContainerModule(bind => {

    // Replace this line with the desired binding, e.g. "bind(CommandContribution).to(ObsExtensionContribution)
    bind(ObsExtensionContribution).toSelf();
});
