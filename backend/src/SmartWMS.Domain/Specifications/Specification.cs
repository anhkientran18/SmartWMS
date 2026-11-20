using System;
using System.Collections.Generic;
using System.Linq.Expressions;

namespace SmartWMS.Domain.Specifications;

public abstract class Specification<T> : ISpecification<T>
{
    public Expression<Func<T, bool>>? Criteria { get; protected set; }

    public List<Expression<Func<T, object>>> Includes { get; } = new();
    public List<string> IncludeStrings { get; } = new();

    public Expression<Func<T, object>>? OrderBy { get; protected set; }
    public Expression<Func<T, object>>? OrderByDescending { get; protected set; }

    public int? Skip { get; protected set; }
    public int? Take { get; protected set; }
    public bool IsPagingEnabled => Skip.HasValue && Take.HasValue;

    public bool AsNoTracking { get; protected set; } = true; // Mặc định là AsNoTracking để tối ưu hiệu năng đọc

    protected void AddInclude(Expression<Func<T, object>> includeExpression)
    {
        Includes.Add(includeExpression);
    }

    protected void AddInclude(string includeString)
    {
        IncludeStrings.Add(includeString);
    }

    protected void ApplyPaging(int skip, int take)
    {
        Skip = skip;
        Take = take;
    }

    protected void ApplyOrderBy(Expression<Func<T, object>> orderBy)
    {
        OrderBy = orderBy;
    }

    protected void ApplyOrderByDescending(Expression<Func<T, object>> orderByDesc)
    {
        OrderByDescending = orderByDesc;
    }

    protected void EnableTracking()
    {
        AsNoTracking = false;
    }

    // Logic gộp các điều kiện (AND) an toàn cho Expression Tree
    protected void AndCriteria(Expression<Func<T, bool>> expression)
    {
        if (Criteria == null)
        {
            Criteria = expression;
            return;
        }

        var parameter = Criteria.Parameters[0];
        var leftBody = Criteria.Body;
        var rightBody = ReplaceParameter(expression.Body, expression.Parameters[0], parameter);

        Criteria = Expression.Lambda<Func<T, bool>>(
            Expression.AndAlso(leftBody, rightBody),
            parameter);
    }

    private static Expression ReplaceParameter(Expression body, ParameterExpression source, ParameterExpression target)
    {
        return new ParameterReplacer(source, target).Visit(body)!;
    }

    private sealed class ParameterReplacer : ExpressionVisitor
    {
        private readonly ParameterExpression _source;
        private readonly ParameterExpression _target;

        public ParameterReplacer(ParameterExpression source, ParameterExpression target)
        {
            _source = source;
            _target = target;
        }

        protected override Expression VisitParameter(ParameterExpression node)
        {
            return node == _source ? _target : base.VisitParameter(node);
        }
    }
}