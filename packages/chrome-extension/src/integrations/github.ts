interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
  email?: string;
  company?: string;
  blog?: string;
  location?: string;
  bio?: string;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  private: boolean;
  owner: GitHubUser;
  html_url: string;
  clone_url: string;
  git_url: string;
  ssh_url: string;
  language?: string;
  forks_count: number;
  stargazers_count: number;
  watchers_count: number;
  size: number;
  default_branch: string;
  open_issues_count: number;
  has_issues: boolean;
  has_projects: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  has_discussions: boolean;
  archived: boolean;
  disabled: boolean;
  pushed_at: string;
  created_at: string;
  updated_at: string;
  permissions: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
    tree: {
      sha: string;
      url: string;
    };
    url: string;
    comment_count: number;
  };
  author: GitHubUser;
  committer: GitHubUser;
  parents: Array<{
    sha: string;
    url: string;
    html_url: string;
  }>;
  html_url: string;
  url: string;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
  files?: Array<{
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
    status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied';
    raw_url: string;
    blob_url: string;
    patch?: string;
  }>;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  user: GitHubUser;
  labels: Array<{
    id: number;
    node_id: string;
    url: string;
    name: string;
    color: string;
    default: boolean;
    description?: string;
  }>;
  state: 'open' | 'closed';
  locked: boolean;
  assignee?: GitHubUser;
  assignees: GitHubUser[];
  milestone?: {
    id: number;
    number: number;
    title: string;
    description?: string;
    creator: GitHubUser;
    open_issues: number;
    closed_issues: number;
    state: 'open' | 'closed';
    created_at: string;
    updated_at: string;
    due_on?: string;
    closed_at?: string;
  };
  comments: number;
  pull_request?: {
    html_url: string;
    diff_url: string;
    patch_url: string;
  };
  closed_at?: string;
  created_at: string;
  updated_at: string;
  closed_by?: GitHubUser;
  html_url: string;
}

interface GitHubPullRequest {
  id: number;
  number: number;
  state: 'open' | 'closed';
  title: string;
  body?: string;
  user: GitHubUser;
  assignee?: GitHubUser;
  assignees: GitHubUser[];
  requested_reviewers: GitHubUser[];
  requested_teams: Array<{
    id: number;
    node_id: string;
    url: string;
    name: string;
    slug: string;
    description?: string;
    privacy: 'secret' | 'closed';
    permission: 'pull' | 'push' | 'admin';
    members_url: string;
    repositories_url: string;
  }>;
  labels: Array<{
    id: number;
    node_id: string;
    url: string;
    name: string;
    color: string;
    default: boolean;
    description?: string;
  }>;
  milestone?: {
    id: number;
    number: number;
    title: string;
    description?: string;
    creator: GitHubUser;
    open_issues: number;
    closed_issues: number;
    state: 'open' | 'closed';
    created_at: string;
    updated_at: string;
    due_on?: string;
    closed_at?: string;
  };
  draft: boolean;
  head: {
    label: string;
    ref: string;
    sha: string;
    user: GitHubUser;
    repo: GitHubRepository;
  };
  base: {
    label: string;
    ref: string;
    sha: string;
    user: GitHubUser;
    repo: GitHubRepository;
  };
  merged_at?: string;
  merge_commit_sha?: string;
  comments: number;
  review_comments: number;
  maintainer_can_modify: boolean;
  commits_url: string;
  review_comments_url: string;
  review_comment_url: string;
  comments_url: string;
  statuses_url: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  merged_by?: GitHubUser;
  mergeable?: boolean;
  rebaseable?: boolean;
  mergeable_state: 'clean' | 'dirty' | 'unstable' | 'blocked';
}

interface GitHubActivity {
  id: string;
  type: 'commit' | 'issue' | 'pull_request' | 'issue_comment' | 'pull_request_review' | 'release' | 'star';
  timestamp: number;
  user: GitHubUser;
  repository: GitHubRepository;
  action: string;
  data: GitHubCommit | GitHubIssue | GitHubPullRequest;
  metadata: {
    language?: string;
    file_types?: string[];
    impact_level: 'low' | 'medium' | 'high';
    category?: string;
  };
}

interface GitHubIntegrationOptions {
  personalAccessToken?: string;
  username?: string;
  repositories?: string[];
  excludeRepos?: string[];
  syncInterval?: number;
  trackPrivateRepos?: boolean;
  trackCommits?: boolean;
  trackIssues?: boolean;
  trackPullRequests?: boolean;
  trackStars?: boolean;
  trackReleases?: boolean;
  webhookSecret?: string;
}

class GitHubIntegration {
  private readonly API_BASE = 'https://api.github.com';
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_RETRIES = 3;
  private readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests

  private accessToken: string | null = null;
  private username: string | null = null;
  private options: GitHubIntegrationOptions;
  private isInitialized = false;
  private syncIntervalId: number | null = null;
  private rateLimitRemaining = 5000;
  private rateLimitReset = 0;
  private lastSync = 0;

  private activityQueue: GitHubActivity[] = [];
  private isProcessing = false;

  constructor(options: GitHubIntegrationOptions = {}) {
    this.options = {
      syncInterval: this.SYNC_INTERVAL,
      trackPrivateRepos: false,
      trackCommits: true,
      trackIssues: true,
      trackPullRequests: true,
      trackStars: true,
      trackReleases: true,
      ...options
    };
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing GitHub integration...');

      // Check for existing access token
      if (this.options.personalAccessToken) {
        this.accessToken = this.options.personalAccessToken;
      } else {
        this.accessToken = await this.getStoredAccessToken();
      }

      if (!this.accessToken) {
        console.warn('GitHub access token not found. Please configure in extension options.');
        return;
      }

      // Get username if not provided
      if (!this.options.username) {
        this.username = await this.getCurrentUsername();
      } else {
        this.username = this.options.username;
      }

      // Validate token and get initial rate limit info
      await this.validateToken();

      // Start background sync
      this.startBackgroundSync();

      this.isInitialized = true;
      console.log('GitHub integration initialized successfully');
    } catch (error) {
      console.error('Failed to initialize GitHub integration:', error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      return this.isInitialized && !!this.accessToken;
    } catch (error) {
      return false;
    }
  }

  async getUserProfile(username: string): Promise<GitHubUser> {
    try {
      const response = await this.makeAuthenticatedRequest(`/users/${username}`);
      return response;
    } catch (error) {
      console.error(`Failed to get user profile for ${username}:`, error);
      throw error;
    }
  }

  async getUserRepositories(username: string, options: {
    type?: 'all' | 'owner' | 'public' | 'private' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  } = {}): Promise<GitHubRepository[]> {
    try {
      const params = new URLSearchParams({
        type: options.type || 'owner',
        sort: options.sort || 'updated',
        direction: options.direction || 'desc',
        per_page: (options.per_page || 100).toString(),
        page: (options.page || 1).toString()
      });

      const response = await this.makeAuthenticatedRequest(`/users/${username}/repos?${params}`);
      return response;
    } catch (error) {
      console.error(`Failed to get repositories for ${username}:`, error);
      throw error;
    }
  }

  async getRepositoryCommits(owner: string, repo: string, options: {
    sha?: string;
    path?: string;
    author?: string;
    since?: string;
    until?: string;
    per_page?: number;
    page?: number;
  } = {}): Promise<GitHubCommit[]> {
    try {
      const params = new URLSearchParams();
      if (options.sha) params.append('sha', options.sha);
      if (options.path) params.append('path', options.path);
      if (options.author) params.append('author', options.author);
      if (options.since) params.append('since', options.since);
      if (options.until) params.append('until', options.until);
      params.append('per_page', (options.per_page || 100).toString());
      params.append('page', (options.page || 1).toString());

      const response = await this.makeAuthenticatedRequest(`/repos/${owner}/${repo}/commits?${params}`);
      return response;
    } catch (error) {
      console.error(`Failed to get commits for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  async getRepositoryIssues(owner: string, repo: string, options: {
    state?: 'open' | 'closed' | 'all';
    labels?: string;
    sort?: 'created' | 'updated' | 'comments';
    direction?: 'asc' | 'desc';
    since?: string;
    per_page?: number;
    page?: number;
  } = {}): Promise<GitHubIssue[]> {
    try {
      const params = new URLSearchParams({
        state: options.state || 'open',
        sort: options.sort || 'updated',
        direction: options.direction || 'desc',
        per_page: (options.per_page || 100).toString(),
        page: (options.page || 1).toString()
      });

      if (options.labels) params.append('labels', options.labels);
      if (options.since) params.append('since', options.since);

      const response = await this.makeAuthenticatedRequest(`/repos/${owner}/${repo}/issues?${params}`);
      return response;
    } catch (error) {
      console.error(`Failed to get issues for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  async getRepositoryPullRequests(owner: string, repo: string, options: {
    state?: 'open' | 'closed' | 'all';
    head?: string;
    base?: string;
    sort?: 'created' | 'updated' | 'popularity' | 'long-running';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  } = {}): Promise<GitHubPullRequest[]> {
    try {
      const params = new URLSearchParams({
        state: options.state || 'open',
        sort: options.sort || 'updated',
        direction: options.direction || 'desc',
        per_page: (options.per_page || 100).toString(),
        page: (options.page || 1).toString()
      });

      if (options.head) params.append('head', options.head);
      if (options.base) params.append('base', options.base);

      const response = await this.makeAuthenticatedRequest(`/repos/${owner}/${repo}/pulls?${params}`);
      return response;
    } catch (error) {
      console.error(`Failed to get pull requests for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  async getActivity(since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)): Promise<GitHubActivity[]> {
    try {
      if (!this.username) {
        throw new Error('Username not available');
      }

      const activities: GitHubActivity[] = [];
      const sinceDate = since.toISOString();

      // Get user repositories
      const repos = await this.getUserRepositories(this.username, {
        per_page: 100,
        sort: 'pushed'
      });

      // Filter repos based on options
      const filteredRepos = repos.filter(repo => {
        if (repo.private && !this.options.trackPrivateRepos) return false;
        if (this.options.excludeRepos?.includes(repo.name)) return false;
        if (this.options.repositories?.length && !this.options.repositories.includes(repo.name)) return false;
        return true;
      });

      // Get activity from each repository
      for (const repo of filteredRepos.slice(0, 20)) { // Limit to 20 repos for performance
        try {
          // Get commits
          if (this.options.trackCommits) {
            const commits = await this.getRepositoryCommits(repo.owner.login, repo.name, {
              since: sinceDate,
              per_page: 50
            });

            for (const commit of commits) {
              activities.push({
                id: `commit_${repo.id}_${commit.sha}`,
                type: 'commit',
                timestamp: new Date(commit.commit.author.date).getTime(),
                user: commit.author,
                repository: repo,
                action: 'committed',
                data: commit,
                metadata: {
                  language: repo.language,
                  file_types: this.extractFileTypes(commit.files),
                  impact_level: this.calculateCommitImpact(commit),
                  category: 'development'
                }
              });
            }
          }

          // Get issues
          if (this.options.trackIssues) {
            const issues = await this.getRepositoryIssues(repo.owner.login, repo.name, {
              since: sinceDate,
              state: 'all',
              per_page: 50
            });

            for (const issue of issues.filter(i => i.state === 'open' || 
              (i.closed_at && new Date(i.closed_at) >= since))) {
              activities.push({
                id: `issue_${repo.id}_${issue.id}`,
                type: 'issue',
                timestamp: new Date(issue.updated_at).getTime(),
                user: issue.user,
                repository: repo,
                action: issue.state === 'open' ? 'opened' : 'closed',
                data: issue,
                metadata: {
                  language: repo.language,
                  impact_level: 'medium',
                  category: 'issue_tracking'
                }
              });
            }
          }

          // Get pull requests
          if (this.options.trackPullRequests) {
            const prs = await this.getRepositoryPullRequests(repo.owner.login, repo.name, {
              state: 'all',
              sort: 'updated',
              per_page: 50
            });

            for (const pr of prs.filter(pr => pr.state === 'open' || 
              (pr.closed_at && new Date(pr.closed_at) >= since))) {
              activities.push({
                id: `pr_${repo.id}_${pr.id}`,
                type: 'pull_request',
                timestamp: new Date(pr.updated_at).getTime(),
                user: pr.user,
                repository: repo,
                action: pr.state === 'open' ? (pr.draft ? 'drafted' : 'opened') : 'closed',
                data: pr,
                metadata: {
                  language: repo.language,
                  impact_level: 'high',
                  category: 'code_review'
                }
              });
            }
          }

          // Rate limiting protection
          await this.delay(this.RATE_LIMIT_DELAY);
        } catch (error) {
          console.warn(`Failed to get activity for ${repo.full_name}:`, error);
        }
      }

      // Sort by timestamp and return
      return activities.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to get GitHub activity:', error);
      throw error;
    }
  }

  async syncActivity(): Promise<void> {
    try {
      if (!this.isInitialized) {
        console.warn('GitHub integration not initialized');
        return;
      }

      console.log('Syncing GitHub activity...');
      const since = new Date(this.lastSync || Date.now() - 24 * 60 * 60 * 1000);
      const activities = await this.getActivity(since);

      // Process activities and create memories
      for (const activity of activities) {
        await this.processActivity(activity);
      }

      this.lastSync = Date.now();
      console.log(`Synced ${activities.length} GitHub activities`);
    } catch (error) {
      console.error('Failed to sync GitHub activity:', error);
    }
  }

  async searchRepositories(query: string, options: {
    sort?: 'stars' | 'forks' | 'help-wanted-issues' | 'updated';
    order?: 'desc' | 'asc';
    per_page?: number;
    page?: number;
  } = {}): Promise<{
    total_count: number;
    incomplete_results: boolean;
    items: GitHubRepository[];
  }> {
    try {
      const params = new URLSearchParams({
        q: query,
        sort: options.sort || 'stars',
        order: options.order || 'desc',
        per_page: (options.per_page || 100).toString(),
        page: (options.page || 1).toString()
      });

      const response = await this.makeAuthenticatedRequest(`/search/repositories?${params}`);
      return response;
    } catch (error) {
      console.error('Failed to search repositories:', error);
      throw error;
    }
  }

  async createIssue(owner: string, repo: string, title: string, body?: string, options: {
    labels?: string[];
    assignees?: string[];
    milestone?: number;
  } = {}): Promise<GitHubIssue> {
    try {
      const data: any = { title };
      if (body) data.body = body;
      if (options.labels) data.labels = options.labels;
      if (options.assignees) data.assignees = options.assignees;
      if (options.milestone) data.milestone = options.milestone;

      const response = await this.makeAuthenticatedRequest(`/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        body: JSON.stringify(data)
      });

      return response;
    } catch (error) {
      console.error(`Failed to create issue in ${owner}/${repo}:`, error);
      throw error;
    }
  }

  async createComment(owner: string, repo: string, issueNumber: number, body: string): Promise<{
    id: number;
    node_id: string;
    url: string;
    html_url: string;
    body: string;
    user: GitHubUser;
    created_at: string;
    updated_at: string;
    issue_url: string;
  }> {
    try {
      const response = await this.makeAuthenticatedRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body })
      });

      return response;
    } catch (error) {
      console.error(`Failed to create comment on ${owner}/${repo}#${issueNumber}:`, error);
      throw error;
    }
  }

  private async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Access token not available');
    }

    const url = `${this.API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `token ${this.accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Spur-Chrome-Extension/1.0',
      ...options.headers as Record<string, string>
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Update rate limit info
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    if (remaining) this.rateLimitRemaining = parseInt(remaining);
    if (reset) this.rateLimitReset = parseInt(reset);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async getStoredAccessToken(): Promise<string | null> {
    try {
      const result = await chrome.storage.sync.get('github_access_token');
      return result.github_access_token || null;
    } catch (error) {
      console.error('Failed to get stored access token:', error);
      return null;
    }
  }

  private async getCurrentUsername(): Promise<string> {
    try {
      const response = await this.makeAuthenticatedRequest('/user');
      return response.login;
    } catch (error) {
      console.error('Failed to get current username:', error);
      throw error;
    }
  }

  private async validateToken(): Promise<void> {
    try {
      const response = await this.makeAuthenticatedRequest('/user');
      console.log(`GitHub token validated for user: ${response.login}`);
    } catch (error) {
      console.error('Invalid GitHub access token:', error);
      throw error;
    }
  }

  private startBackgroundSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }

    this.syncIntervalId = window.setInterval(() => {
      this.syncActivity();
    }, this.options.syncInterval || this.SYNC_INTERVAL);

    console.log(`Background sync started with ${this.options.syncInterval || this.SYNC_INTERVAL}ms interval`);
  }

  private stopBackgroundSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
      console.log('Background sync stopped');
    }
  }

  private async processActivity(activity: GitHubActivity): Promise<void> {
    try {
      // Create memory from activity
      const content = this.formatActivityContent(activity);
      
      // Store activity in local storage
      await this.storeActivity(activity);

      // Send to background service for memory creation
      if (chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'github_activity',
          action: 'create_memory',
          data: {
            content,
            metadata: {
              source: 'github',
              activity_type: activity.type,
              repository: activity.repository.full_name,
              user: activity.user.login,
              timestamp: activity.timestamp,
              ...activity.metadata
            }
          }
        });
      }

      console.log(`Processed ${activity.type} activity: ${activity.action} in ${activity.repository.full_name}`);
    } catch (error) {
      console.error('Failed to process GitHub activity:', error);
    }
  }

  private formatActivityContent(activity: GitHubActivity): string {
    switch (activity.type) {
      case 'commit':
        const commit = activity.data as GitHubCommit;
        return `GitHub commit in ${activity.repository.full_name}: ${commit.commit.message.substring(0, 100)}${commit.commit.message.length > 100 ? '...' : ''}`;
      
      case 'issue':
        const issue = activity.data as GitHubIssue;
        return `GitHub issue ${activity.action} in ${activity.repository.full_name}: ${issue.title}`;
      
      case 'pull_request':
        const pr = activity.data as GitHubPullRequest;
        return `GitHub pull request ${activity.action} in ${activity.repository.full_name}: ${pr.title}`;
      
      default:
        return `GitHub activity: ${activity.action} in ${activity.repository.full_name}`;
    }
  }

  private async storeActivity(activity: GitHubActivity): Promise<void> {
    try {
      const key = `github_activity_${activity.id}`;
      await chrome.storage.local.set({
        [key]: {
          ...activity,
          synced_at: Date.now()
        }
      });
    } catch (error) {
      console.error('Failed to store GitHub activity:', error);
    }
  }

  private extractFileTypes(files?: Array<{ filename: string }>): string[] {
    if (!files) return [];
    
    const types = new Set<string>();
    for (const file of files) {
      const ext = file.filename.split('.').pop()?.toLowerCase();
      if (ext && ext !== file.filename) {
        types.add(ext);
      }
    }
    
    return Array.from(types);
  }

  private calculateCommitImpact(commit: GitHubCommit): 'low' | 'medium' | 'high' {
    if (!commit.stats) return 'medium';
    
    const totalChanges = commit.stats.additions + commit.stats.deletions;
    if (totalChanges > 1000) return 'high';
    if (totalChanges > 100) return 'medium';
    return 'low';
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async configure(options: GitHubIntegrationOptions): Promise<void> {
    try {
      this.options = { ...this.options, ...options };
      
      if (options.personalAccessToken) {
        this.accessToken = options.personalAccessToken;
        await chrome.storage.sync.set({ github_access_token: options.personalAccessToken });
      }

      if (options.username) {
        this.username = options.username;
      }

      // Restart background sync with new interval
      if (this.isInitialized) {
        this.stopBackgroundSync();
        this.startBackgroundSync();
      }

      console.log('GitHub integration configured successfully');
    } catch (error) {
      console.error('Failed to configure GitHub integration:', error);
      throw error;
    }
  }

  async getStats(): Promise<{
    totalRepos: number;
    totalCommits: number;
    totalIssues: number;
    totalPullRequests: number;
    lastSync: number;
    rateLimitRemaining: number;
    username: string | null;
  }> {
    try {
      if (!this.username) {
        throw new Error('Username not available');
      }

      const repos = await this.getUserRepositories(this.username, { per_page: 1 });
      const totalRepos = repos.length > 0 ? parseInt(repos[0].owner.public_repos.toString()) : 0;

      // Get recent activity counts
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
      const activity = await this.getActivity(since);
      
      const totalCommits = activity.filter(a => a.type === 'commit').length;
      const totalIssues = activity.filter(a => a.type === 'issue').length;
      const totalPullRequests = activity.filter(a => a.type === 'pull_request').length;

      return {
        totalRepos,
        totalCommits,
        totalIssues,
        totalPullRequests,
        lastSync: this.lastSync,
        rateLimitRemaining: this.rateLimitRemaining,
        username: this.username
      };
    } catch (error) {
      console.error('Failed to get GitHub stats:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    try {
      this.stopBackgroundSync();
      this.accessToken = null;
      this.username = null;
      this.isInitialized = false;
      this.activityQueue = [];
      console.log('GitHub integration destroyed');
    } catch (error) {
      console.error('Failed to destroy GitHub integration:', error);
    }
  }
}

export const gitHubIntegration = new GitHubIntegration();
export { GitHubIntegration, type GitHubIntegrationOptions, type GitHubActivity, type GitHubUser, type GitHubRepository, type GitHubCommit, type GitHubIssue, type GitHubPullRequest };