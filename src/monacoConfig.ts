import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';

// Bundle Monaco with the application so the editor works without reaching the
// jsDelivr CDN. Markdown only needs the core editor worker.
self.MonacoEnvironment = {
    getWorker() {
        return new editorWorker();
    },
};

loader.config({ monaco });
