/**
 * Generated using theia-extension-generator
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import { AudioExtensionContribution } from './audio-extension-contribution';
import { Texttospeech } from './Texttospeech';

export default new ContainerModule((bind) => {
	// Replace this line with the desired binding, e.g. "bind(CommandContribution).to(AudioExtensionContribution)
	bind(AudioExtensionContribution).toSelf();
	bind(Texttospeech).toSelf();
});
