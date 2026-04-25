export interface RequestUser {
  sub: string;
  roles: string[];
  managerOf?: string[];
}
