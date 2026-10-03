"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validator = void 0;
class Validator {
    /**
     * Menganalisis konten Markdown dan mengekstrak status GFM Task List (- [ ] dan - [x]).
     */
    validateContent(content) {
        const taskRegex = /^\s*[-*+]\s*\[([ xX])\]\s*(.+)$/gm;
        let totalTasks = 0;
        let completedTasks = 0;
        const pendingTasks = [];
        let match;
        while ((match = taskRegex.exec(content)) !== null) {
            totalTasks++;
            const isChecked = match[1].toLowerCase() === 'x';
            const taskText = match[2].trim();
            if (isChecked) {
                completedTasks++;
            }
            else {
                pendingTasks.push(taskText);
            }
        }
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
        return {
            totalTasks,
            completedTasks,
            progressPercentage,
            pendingTasks,
        };
    }
}
exports.Validator = Validator;
