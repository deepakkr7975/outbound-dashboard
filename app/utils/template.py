def render_template(template: str, variables: dict) -> str:
    """
    Replaces {{key}} with value from variables dictionary.
    """
    rendered = template
    for key, value in variables.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", str(value))
    return rendered
