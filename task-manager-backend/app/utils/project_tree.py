Parents = dict[int, int | None]


def depth_of(parents: Parents, project_id: int) -> int:
    depth = 1
    parent_id = parents[project_id]
    while parent_id is not None:
        depth += 1
        parent_id = parents[parent_id]
    return depth


def descendant_ids(parents: Parents, project_id: int) -> set[int]:
    found = {project_id}
    grew = True
    while grew:
        grew = False
        for child_id, parent_id in parents.items():
            if parent_id in found and child_id not in found:
                found.add(child_id)
                grew = True
    return found


def height_of(parents: Parents, project_id: int) -> int:
    members = descendant_ids(parents, project_id)
    return (
        max(depth_of(parents, member) for member in members)
        - depth_of(parents, project_id)
        + 1
    )


def root_of(parents: Parents, project_id: int) -> int:
    while parents[project_id] is not None:
        project_id = parents[project_id]  # type: ignore[assignment]
    return project_id
