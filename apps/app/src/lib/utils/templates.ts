// Import the JSON templates
import templatesData from '@/components/templates.json';

// Type definitions for templates
export type TemplateVariant = {
    id: string;
    name: string;
    description: string;
    jobDefinition: Record<string, any>;
};

export type Template = {
    id: string;
    name: string;
    category: string[];
    icon: string;
    jobDefinition?: Record<string, any>;
    variants?: TemplateVariant[];
};

// Export the templates from JSON
export const templates: Template[] = templatesData as Template[];

// Helper function to group templates by category
export function getTemplatesByCategory(): Record<string, Template[]> {
    const grouped: Record<string, Template[]> = {};
    
    templates.forEach(template => {
        // Use the first category as the primary category
        const primaryCategory = template.category[0] || 'Other';
        
        if (!grouped[primaryCategory]) {
            grouped[primaryCategory] = [];
        }
        grouped[primaryCategory].push(template);
    });
    
    return grouped;
}

// Helper function to get all categories
export function getAllCategories(): string[] {
    const categories = new Set<string>();
    templates.forEach(template => {
        template.category.forEach(cat => categories.add(cat));
    });
    return Array.from(categories).sort();
}
