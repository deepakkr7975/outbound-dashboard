"""
Modal deployment for the Email Automation Platform.

    modal serve modal_app.py     # live-reloading dev
    modal deploy modal_app.py    # production

The APScheduler jobs from app/scheduler/cron.py are NOT run in-process here.
A Modal web container scales to zero, so an in-process scheduler stops ticking
whenever there is no HTTP traffic and double-ticks whenever Modal runs more
than one container. They are Modal scheduled functions instead (below).
"""

import modal

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install_from_requirements("requirements.txt")
    .add_local_python_source("app")
)

secrets = [modal.Secret.from_name("email-automation")]

modal_app = modal.App("email-automation")


@modal_app.function(image=image, secrets=secrets, min_containers=1)
@modal.concurrent(max_inputs=100)
@modal.asgi_app()
def fastapi_app():
    from app.main import app

    return app


# ── Scheduled jobs (replacing APScheduler) ───────────────────────────────────
# max_containers=1 serializes runs: a tick that overruns its minute queues the
# next one rather than sending the same transaction twice.

@modal_app.function(
    image=image, secrets=secrets, schedule=modal.Cron("30 18 * * *"),
    max_containers=1, timeout=600,
)
def process_email_transactions():
    from app.scheduler.cron import process_email_transactions as job

    job()


@modal_app.function(
    image=image, secrets=secrets, schedule=modal.Cron("0 0 * * *"),
    max_containers=1, timeout=900,
)
def reset_daily_counters():
    from app.scheduler.cron import reset_daily_counters as job

    job()


# ── One-off table setup: `modal run modal_app.py::init_tables` ───────────────

@modal_app.function(image=image, secrets=secrets, timeout=900)
def init_tables():
    from app.database.init_dynamodb import init_tables as job

    job()
