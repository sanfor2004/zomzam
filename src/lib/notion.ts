import axios from 'axios';

export interface NotionTaskProperties {
  title: string;
  priority: 'urgent' | 'medium' | 'maybe' | 'free';
  duration_block: number;
  actual_duration: number | null;
  status: 'pending' | 'in_progress' | 'completed' | 'deleted';
  projectNotionPageId: string | null;
  linksNotionPageIds: string[];
}

export interface NotionProjectProperties {
  name: string;
  status: 'planning' | 'in_design' | 'review' | 'delivered';
}

export interface NotionLinkProperties {
  title: string;
  url: string;
}

/**
 * Notion API Service Wrapper
 */
export class NotionService {
  private apiKey: string;
  private headers: Record<string, string>;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Queries a database in Notion and returns its pages
   */
  async queryDatabase(databaseId: string): Promise<any[]> {
    try {
      const response = await axios.post(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        {},
        { headers: this.headers }
      );
      return response.data.results || [];
    } catch (error: any) {
      console.error(`Error querying Notion database ${databaseId}:`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || `Failed to query Notion database ${databaseId}`);
    }
  }

  /**
   * Creates a page in a Notion database
   */
  async createPage(databaseId: string, properties: any): Promise<string> {
    try {
      const response = await axios.post(
        'https://api.notion.com/v1/pages',
        {
          parent: { database_id: databaseId },
          properties,
        },
        { headers: this.headers }
      );
      return response.data.id;
    } catch (error: any) {
      console.error('Error creating Notion page:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to create Notion page');
    }
  }

  /**
   * Updates an existing Notion page properties
   */
  async updatePage(pageId: string, properties: any): Promise<void> {
    try {
      await axios.patch(
        `https://api.notion.com/v1/pages/${pageId}`,
        { properties },
        { headers: this.headers }
      );
    } catch (error: any) {
      console.error(`Error updating Notion page ${pageId}:`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || `Failed to update Notion page ${pageId}`);
    }
  }

  /**
   * Parses a Notion page into Zomzam Task properties
   */
  parseTask(page: any): NotionTaskProperties {
    const props = page.properties;

    // Title / Name
    const title = props.Name?.title?.[0]?.plain_text || 'Unnamed Notion Task';

    // Priority mapping (Notion: low, medium, high, higher -> Zomzam: free, maybe, medium, urgent)
    const notionPriority = props.Priority?.select?.name?.toLowerCase() || 'medium';
    let priority: 'urgent' | 'medium' | 'maybe' | 'free' = 'medium';
    if (notionPriority === 'low') priority = 'free';
    else if (notionPriority === 'medium') priority = 'maybe';
    else if (notionPriority === 'high') priority = 'medium';
    else if (notionPriority === 'higher') priority = 'urgent';

    // Status mapping (Notion status -> Zomzam: pending, in_progress, completed)
    const notionStatus = props.status?.status?.name || props.status?.select?.name || 'New';
    let status: 'pending' | 'in_progress' | 'completed' | 'deleted' = 'pending';
    if (notionStatus === 'Done') {
      status = 'completed';
    } else if (notionStatus === 'In Progress' || notionStatus === 'PR In Progress') {
      status = 'in_progress';
    } else {
      status = 'pending';
    }

    // Durations in hours -> converted to Zomzam blocks (minutes)
    const estHours = props['Estimated Time In Hours']?.number || 0;
    const duration_block = estHours > 0 ? Math.round(estHours * 60) : 25; // fallback to 25 mins

    const actHours = props['Actual Time in hours']?.number || null;
    const actual_duration = actHours !== null && actHours > 0 ? Math.round(actHours * 60) : null;

    // Project Relation
    const projectNotionPageId = props.Project?.relation?.[0]?.id || null;

    // Links Relation
    const linksNotionPageIds = props.Links?.relation?.map((r: any) => r.id) || [];

    return {
      title,
      priority,
      duration_block,
      actual_duration,
      status,
      projectNotionPageId,
      linksNotionPageIds,
    };
  }

  /**
   * Parses a Notion page into Zomzam Project properties
   */
  parseProject(page: any): NotionProjectProperties {
    const props = page.properties;
    const name = props.Name?.title?.[0]?.plain_text || 'Unnamed Notion Project';
    
    const notionStatus = props.status?.status?.name || props.status?.select?.name || 'Planning';
    let status: 'planning' | 'in_design' | 'review' | 'delivered' = 'planning';
    if (notionStatus === 'In Design') status = 'in_design';
    else if (notionStatus === 'Review') status = 'review';
    else if (notionStatus === 'Delivered') status = 'delivered';

    return { name, status };
  }

  /**
   * Parses a Notion page into Zomzam Link properties
   */
  parseLink(page: any): NotionLinkProperties {
    const props = page.properties;
    const title = props.Name?.title?.[0]?.plain_text || 'Unnamed Notion Link';
    const url = props.URL?.url || '';
    return { title, url };
  }

  /**
   * Builds the properties payload to send to Notion for a Task
   */
  buildTaskProperties(task: NotionTaskProperties) {
    let notionPriority = 'medium';
    if (task.priority === 'free') notionPriority = 'low';
    else if (task.priority === 'maybe') notionPriority = 'medium';
    else if (task.priority === 'medium') notionPriority = 'high';
    else if (task.priority === 'urgent') notionPriority = 'higher';

    let notionStatus = 'New';
    if (task.status === 'completed') notionStatus = 'Done';
    else if (task.status === 'in_progress') notionStatus = 'In Progress';
    else if (task.status === 'pending') notionStatus = 'New';

    const props: any = {
      Name: {
        title: [{ text: { content: task.title } }]
      },
      Priority: {
        select: { name: notionPriority }
      },
      status: {
        status: { name: notionStatus }
      },
      'Estimated Time In Hours': {
        number: Number((task.duration_block / 60).toFixed(2))
      },
      'Actual Time in hours': {
        number: task.actual_duration ? Number((task.actual_duration / 60).toFixed(2)) : 0
      }
    };

    if (task.projectNotionPageId) {
      props.Project = {
        relation: [{ id: task.projectNotionPageId }]
      };
    } else {
      props.Project = {
        relation: []
      };
    }

    if (task.linksNotionPageIds && task.linksNotionPageIds.length > 0) {
      props.Links = {
        relation: task.linksNotionPageIds.map(id => ({ id }))
      };
    } else {
      props.Links = {
        relation: []
      };
    }

    return props;
  }

  /**
   * Builds the properties payload to send to Notion for a Project
   */
  buildProjectProperties(project: NotionProjectProperties) {
    let notionStatus = 'Planning';
    if (project.status === 'planning') notionStatus = 'Planning';
    else if (project.status === 'in_design') notionStatus = 'In Design';
    else if (project.status === 'review') notionStatus = 'Review';
    else if (project.status === 'delivered') notionStatus = 'Delivered';

    return {
      Name: {
        title: [{ text: { content: project.name } }]
      },
      status: {
        status: { name: notionStatus }
      }
    };
  }

  /**
   * Builds the properties payload to send to Notion for a Link
   */
  buildLinkProperties(link: NotionLinkProperties) {
    return {
      Name: {
        title: [{ text: { content: link.title } }]
      },
      URL: {
        url: link.url || ''
      }
    };
  }
}
