import { Component, Injectable, OnInit, OnDestroy } from "@angular/core";
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  Resolve,
  Router,
  RouterStateSnapshot,
} from "@angular/router";
import {
  MetricsList,
  ApiMetrics,
  Metrics,
  ConsoleService,
  UserRole,
} from "../console.service";
import { Observable, Subject } from "rxjs";
import { UntypedFormBuilder, UntypedFormGroup } from "@angular/forms";
import { AuthenticationService } from "../authentication.service";
import { DeleteConfirmService } from "../shared/delete-confirm.service";
import { NgbActiveModal, NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { takeUntil } from "rxjs/operators";

@Component({
  templateUrl: "./metrics.component.html",
  styleUrls: ["./metrics.component.scss"],
})
export class MetricsComponent implements OnInit {
  public readonly systemUserId = "00000000-0000-0000-0000-000000000000";
  public error = "";
  public metricsCount = 0;
  public metrics: Array<ApiMetrics> = [];
  public metrics_hidden: Array<ApiMetrics> = [];
  public nextCursor = "";
  public prevCursor = "";
  public searchForm: UntypedFormGroup;
  public querySubject: Subject<void>;
  public ongoingQuery = false;
  public curr_responses: Array<any> = null;
  public button_label: "View" | "Hide" = "View";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly consoleService: ConsoleService,
    private readonly authService: AuthenticationService,
    private readonly formBuilder: UntypedFormBuilder,
    private readonly deleteConfirmService: DeleteConfirmService,
  ) {}

  ngOnInit(): void {
    this.querySubject = new Subject<void>();
    this.searchForm = this.formBuilder.group({
      filter: [""],
      filter_type: [0], // 0 for all, 1 for tombstones
    });

    const qp = this.route.snapshot.queryParamMap;
    this.f.filter.setValue(qp.get("filter"));
    this.f.filter_type.setValue(+qp.get("filter_type"));
    this.nextCursor = qp.get("cursor");

    if (this.nextCursor && this.nextCursor !== "") {
      this.search(1);
    } else if (this.f.filter.value || this.f.filter_type.value) {
      this.search(0);
    }

    this.route.data.subscribe(
      (d) => {
        this.metrics.length = 0;
        if (d) {
          this.metrics.push(...d[0].metrics);
          this.metricsCount = d[0].metrics.length;
          this.nextCursor = d[0].next_cursor;
          this.prevCursor = d[0].prev_cursor;
        }
      },
      (err) => {
        this.error = err;
      },
    );
  }

  ngOnDestroy(): void {
    this.querySubject.next();
    this.querySubject.complete();
  }

  search(state: number): void {
    if (this.ongoingQuery) {
      this.querySubject.next();
    }
    this.ongoingQuery = true;

    let cursor = "";
    switch (state) {
      case -1:
        cursor = this.prevCursor;
        break;
      case 0:
        cursor = "";
        break;
      case 1:
        cursor = this.nextCursor;
        break;
    }

    const tombstones =
      this.f.filter_type.value && this.f.filter_type.value === 1;

    this.consoleService
      .listMetrics("", this.f.filter.value, tombstones, cursor)
      .pipe(takeUntil(this.querySubject))
      .subscribe(
        (d) => {
          this.error = "";

          this.metrics.length = 0;
          this.metrics.push(...d.metrics);
          this.metricsCount = d.metrics.length;
          this.nextCursor = d.next_cursor;

          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
              filter: this.f.filter.value,
              filter_type: this.f.filter_type.value,
              cursor,
            },
            queryParamsHandling: "merge",
          });
          this.ongoingQuery = false;
        },
        (err) => {
          this.error = err;
          this.ongoingQuery = false;
        },
      );
  }

  cancelQuery(): void {
    this.querySubject.next();
    this.ongoingQuery = false;
  }

  deleteAllowed(): boolean {
    // only admin and developers are allowed.
    return this.authService.sessionRole <= UserRole.USER_ROLE_DEVELOPER;
  }

  viewAccount(u: ApiMetrics): void {
    this.router.navigate(["/accounts", u.id], { relativeTo: this.route });
  }

  setCurrentResponses(id: string, responses: Array<any>): void {
    if (this.button_label === "View") {
      this.metrics_hidden = this.metrics;
      this.metrics = this.metrics.filter((m) => m.id === id);
      this.curr_responses = responses;
      this.button_label = "Hide";
    } else {
      this.metrics = this.metrics_hidden;
      this.metrics_hidden = [];
      this.curr_responses = null;
      this.button_label = "View";
    }
  }

  get f(): any {
    return this.searchForm.controls;
  }
}

@Injectable({ providedIn: "root" })
export class MetricsResolver implements Resolve<MetricsList> {
  constructor(private readonly consoleService: ConsoleService) {}

  resolve(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Observable<MetricsList> {
    const filter = route.queryParamMap.get("filter");
    const tombstones = route.queryParamMap.get("tombstones");

    return this.consoleService.listMetrics(
      "",
      filter,
      tombstones === "true",
      null,
    );
  }
}
