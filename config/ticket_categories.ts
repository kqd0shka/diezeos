export interface TicketCategory {
    id: string;
    name: string;
    emoji: string;
    description: string;
    fields: {
        name: string;
        type: 'user' | 'text' | 'textarea' | 'select';
        required: boolean;
        placeholder?: string;
        options?: { 
            label: string;
            value: string;
        }[];
    }[];
}


export const TICKET_CATEGORIES: TicketCategory[] = [
    {
        id: 'report',
        name: '🚨Репорт',
        emoji: '🚨',
        description: 'Сообщить о нарушителе',
        fields: [
            { name: 'targetUser', type: 'user', required: true, placeholder: 'ID нарушителя' },
            { name: 'reason', type: 'textarea', required: true, placeholder: 'Опишите жалобу' },
        ]
    },
    {
        id: 'suggestion',
        name: '💡 Предложение',
        emoji: '💡',
        description: 'Предложение для сервера',
        fields: [
            { name: 'title', type: 'text', required: true, placeholder: 'Краткий заголовок' },
            { name: 'description', type: 'textarea', required: true, placeholder: 'Опишите ваше предложение подробно' }
        ]
    },
    {
        id: 'support',
        name: '❓ Помощь',
        emoji: '❓',
        description: 'Нужна помощь или есть вопрос',
        fields: [
            { name: 'topic', type: 'select', required: true, options: [
                { label: 'Технический вопрос', value: 'tech' },
                { label: 'Правила сервера', value: 'rules' },
                { label: 'Бот', value: 'bot' },
                { label: 'Другое', value: 'other' }
            ]},
            { name: 'description', type: 'textarea', required: true, placeholder: 'Опишите ваш вопрос' }
        ]
    },
    {
        id: 'other',
        name: '📝 Другое',
        emoji: '📝',
        description: 'Любая другая тема',
        fields: [
            { name: 'description', type: 'textarea', required: true, placeholder: 'Опишите, что вам нужно' }
        ]
    }
];