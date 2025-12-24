import logging
from typing import Any, Dict, Iterable, List, Optional, Tuple

from supabase import Client, create_client


class SupabaseClient:
    def __init__(self, url: str, key: str, logger: logging.Logger, dry_run: bool = False) -> None:
        self.client: Client = create_client(url, key)
        self.logger = logger
        self.dry_run = dry_run

    def _execute(self, query: Any, label: str, allow_write: bool) -> List[Dict[str, Any]]:
        if self.dry_run and allow_write:
            self.logger.info("DRY RUN: skip %s", label)
            return []
        response = query.execute()
        error = getattr(response, "error", None)
        if error:
            raise RuntimeError(str(error))
        return response.data or []

    def select(
        self,
        table: str,
        columns: str = "*",
        filters: Optional[List[Tuple[str, str, Any]]] = None,
        order: Optional[Tuple[str, bool]] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        query = self.client.table(table).select(columns)
        if filters:
            for filter_tuple in filters:
                op = filter_tuple[0]
                if op == "or":
                    # Expecting ("or", "filter_string")
                    if len(filter_tuple) < 2:
                        continue
                    query = query.or_(filter_tuple[1])
                elif len(filter_tuple) == 3:
                    op, column, value = filter_tuple
                    if op == "eq":
                        query = query.eq(column, value)
                    elif op == "neq":
                        query = query.neq(column, value)
                    elif op == "lt":
                        query = query.lt(column, value)
                    elif op == "lte":
                        query = query.lte(column, value)
                    elif op == "gt":
                        query = query.gt(column, value)
                    elif op == "gte":
                        query = query.gte(column, value)
                    elif op == "in":
                        query = query.in_(column, value)
                    elif op == "is":
                        query = query.is_(column, value)
                    elif op == "like":
                        query = query.like(column, value)
                    elif op == "ilike":
                        query = query.ilike(column, value)
                    else:
                        raise ValueError(f"Unsupported filter op: {op}")
                else:
                    raise ValueError(f"Invalid filter tuple format: {filter_tuple}")
        if order:
            column, desc = order
            query = query.order(column, desc=desc)
        if limit:
            query = query.limit(limit)
        return self._execute(query, f"select {table}", allow_write=False)

    def insert(self, table: str, data: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
        payload = list(data)
        if not payload:
            return []
        query = self.client.table(table).insert(payload)
        return self._execute(query, f"insert {table}", allow_write=True)

    def upsert(self, table: str, data: Iterable[Dict[str, Any]], on_conflict: Optional[str] = None) -> List[Dict[str, Any]]:
        payload = list(data)
        if not payload:
            return []
        query = self.client.table(table).upsert(payload, on_conflict=on_conflict)
        return self._execute(query, f"upsert {table}", allow_write=True)

    def update(
        self,
        table: str,
        updates: Dict[str, Any],
        filters: Optional[List[Tuple[str, str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        query = self.client.table(table).update(updates)
        if filters:
            for op, column, value in filters:
                if op == "eq":
                    query = query.eq(column, value)
                elif op == "in":
                    query = query.in_(column, value)
                else:
                    raise ValueError(f"Unsupported filter op: {op}")
        return self._execute(query, f"update {table}", allow_write=True)

    def delete(
        self,
        table: str,
        filters: Optional[List[Tuple[str, str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        query = self.client.table(table).delete()
        if filters:
            for op, column, value in filters:
                if op == "eq":
                    query = query.eq(column, value)
                elif op == "in":
                    query = query.in_(column, value)
                else:
                    raise ValueError(f"Unsupported filter op: {op}")
        return self._execute(query, f"delete {table}", allow_write=True)
