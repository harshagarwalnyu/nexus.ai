class WhisperService {
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.OPENAI_API_KEY;
        this.isReady = true;
    }

    async transcribe(audioData) {
        console.log('[WhisperService] Processing audio transcription...');

        if (!this.apiKey) {
            console.warn('[WhisperService] No OPENAI_API_KEY provided. Returning stubbed response.');
            await new Promise(resolve => setTimeout(resolve, 1000));
            return {
                status: 'success',
                text: 'This is a stubbed transcription of the earnings call. We expect strong growth in Q3.',
                language: 'en',
                segments: [
                    { start: 0, end: 5, text: 'This is a stubbed transcription of the earnings call.' },
                    { start: 5, end: 10, text: 'We expect strong growth in Q3.' }
                ]
            };
        }

        try {
            const formData = new FormData();

            let file;
            if (audioData instanceof Buffer) {
                file = new Blob([ (audioData)], { type: 'audio/mpeg' });
                formData.append('file', file, 'audio.mp3');
            } else if (typeof audioData === 'string' && audioData.startsWith('http')) {

                 const audioRes = await fetch(audioData);
                 if (!audioRes.ok) throw new Error(`Failed to fetch audio from URL: ${audioRes.status}`);
                 file = await audioRes.blob();
                 formData.append('file', file, 'audio.mp3');
            } else {

                file = new Blob([new Uint8Array([0])], { type: 'audio/mpeg' });
                formData.append('file', file, 'dummy.mp3');
            }

            formData.append('model', 'whisper-1');
            formData.append('response_format', 'verbose_json');

            console.log('[WhisperService] Calling OpenAI Whisper API...');
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[WhisperService] OpenAI API error:', errorData);
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            console.log('[WhisperService] Transcription successful.');

            return {
                status: 'success',
                text: data.text,
                language: data.language || 'en',
                segments: data.segments || []
            };
        } catch (error) {
            console.error('[WhisperService] Error during transcription:', error.message);

            throw error;
        }
    }
}

export default new WhisperService();